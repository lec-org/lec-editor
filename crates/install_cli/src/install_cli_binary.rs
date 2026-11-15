use super::register_zed_scheme;
use anyhow::{Context as _, Result};
use gpui::{Context, Window, actions};
use release_channel::ReleaseChannel;
use std::io;
use std::path::{Path, PathBuf};
use util::ResultExt;
use workspace::notifications::{DetachAndPromptErr, NotificationId};
use workspace::{Toast, Workspace};

actions!(
    cli,
    [
        /// 安装 line 命令行工具。
        InstallCliBinary,
    ]
);

async fn install_link(cli_path: &Path, link_path: &Path) -> io::Result<()> {
    if smol::fs::read_link(link_path).await.ok().as_deref() == Some(cli_path) {
        return Ok(());
    }
    let parent = link_path
        .parent()
        .ok_or_else(|| io::Error::other("命令路径缺少父目录"))?;
    smol::fs::create_dir_all(parent).await?;
    match smol::fs::symlink_metadata(link_path).await {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            smol::fs::remove_file(link_path).await?
        }
        Ok(_) => {
            return Err(io::Error::new(
                io::ErrorKind::AlreadyExists,
                "同名文件已存在，未覆盖",
            ));
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => {}
        Err(error) => return Err(error),
    }
    smol::fs::unix::symlink(cli_path, link_path).await
}

async fn install_script() -> Result<Option<PathBuf>> {
    let cli_path = util::get_zed_cli_path()?;
    let directory = if cfg!(target_os = "macos") {
        PathBuf::from("/usr/local/bin")
    } else {
        PathBuf::from(std::env::var_os("HOME").context("无法确定用户主目录")?).join(".local/bin")
    };
    let link_path = directory.join("line");
    if let Err(error) = install_link(&cli_path, &link_path).await {
        if !cfg!(target_os = "macos") || error.kind() != io::ErrorKind::PermissionDenied {
            return Err(error).with_context(|| format!("无法安装命令到 {}", link_path.display()));
        }
        // 路径作为参数传入 AppleScript，再由 quoted form 转义，兼容空格与引号。
        let output = smol::process::Command::new("/usr/bin/osascript")
            .args(["-e", r#"on run arguments
set sourcePath to quoted form of item 1 of arguments
set targetPath to quoted form of item 2 of arguments
set binPath to quoted form of item 3 of arguments
do shell script "mkdir -p " & binPath & " && if [ -e " & targetPath & " ] && [ ! -L " & targetPath & " ]; then exit 1; fi; ln -sf " & sourcePath & " " & targetPath with administrator privileges
end run"#])
            .arg(&cli_path)
            .arg(&link_path)
            .arg(&directory)
            .output()
            .await?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if stderr.contains("User canceled") || stderr.contains("-128") {
                return Ok(None);
            }
            anyhow::bail!("无法安装 line 命令：{}", stderr.trim());
        }
    }
    // 不区分大小写时已是同一入口；区分大小写时尝试添加可选别名。
    if let Err(error) = install_link(&cli_path, &directory.join("Line")).await {
        log::warn!("未安装可选 Line 命令别名：{error}");
    }
    Ok(Some(link_path))
}

pub fn install_cli_binary(window: &mut Window, cx: &mut Context<Workspace>) {
    cx.spawn_in(window, async move |workspace, cx| {
        let Some(path) = install_script().await? else {
            return Ok(());
        };
        workspace.update_in(cx, |workspace, _, cx| {
            struct InstalledLineCli;
            let mut message = format!(
                "已安装 line 命令到 {}，现在可以从终端启动 {}。",
                path.display(),
                ReleaseChannel::global(cx).display_name()
            );
            if cfg!(any(target_os = "linux", target_os = "freebsd")) {
                message.push_str("若找不到命令，请将 ~/.local/bin 加入 PATH。");
            }
            workspace.show_toast(
                Toast::new(NotificationId::unique::<InstalledLineCli>(), message),
                cx,
            )
        })?;
        register_zed_scheme(cx).await.log_err();
        Ok(())
    })
    .detach_and_prompt_err("无法安装 Line 命令行工具", window, cx, |_, _, _| None);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn installs_command_aliases_and_preserves_existing_files() -> Result<()> {
        smol::block_on(async {
            let directory = tempfile::tempdir()?;
            let cli = directory.path().join("Line 编辑器's CLI");
            smol::fs::write(&cli, "cli").await?;
            let command = directory.path().join("bin/line");
            install_link(&cli, &command).await?;
            install_link(&cli, &command).await?;
            install_link(&cli, &command.with_file_name("Line")).await?;
            assert_eq!(smol::fs::read_to_string(&command).await?, "cli");
            assert_eq!(
                smol::fs::read_to_string(command.with_file_name("Line")).await?,
                "cli"
            );

            let replacement = directory.path().join("new-cli");
            smol::fs::write(&replacement, "updated").await?;
            install_link(&replacement, &command).await?;
            assert_eq!(smol::fs::read_to_string(&command).await?, "updated");

            let existing = directory.path().join("bin/existing");
            smol::fs::write(&existing, "preserve").await?;
            assert_eq!(
                install_link(&cli, &existing).await.unwrap_err().kind(),
                io::ErrorKind::AlreadyExists
            );
            assert_eq!(smol::fs::read_to_string(existing).await?, "preserve");
            Ok(())
        })
    }
}
