use anyhow::{Context as _, anyhow};
use editor::Editor;
use gpui::{Context, Window};
use i18n::t;
use task::{RevealStrategy, Shell, SpawnInTerminal, TaskId};
use terminal_view::terminal_panel::TerminalPanel;
use util::ResultExt as _;
use workspace::{SaveIntent, Toast, Workspace, notifications::NotificationId};
use zed_actions::RunCurrentFile;

fn show_error(workspace: &mut Workspace, message: String, cx: &mut Context<Workspace>) {
    workspace.show_toast(
        Toast::new(NotificationId::unique::<RunCurrentFile>(), message),
        cx,
    );
}

pub fn run(
    workspace: &mut Workspace,
    _: &RunCurrentFile,
    window: &mut Window,
    cx: &mut Context<Workspace>,
) {
    let Some(editor) = workspace.active_item_as::<Editor>(cx) else {
        show_error(
            workspace,
            t!("Open a C or C++ source file to run.").into(),
            cx,
        );
        return;
    };
    let Some(buffer) = editor.read(cx).buffer().read(cx).as_singleton() else {
        show_error(
            workspace,
            t!("Open a C or C++ source file to run.").into(),
            cx,
        );
        return;
    };
    if workspace.project().read(cx).is_via_remote_server()
        || workspace.project().read(cx).is_via_collab()
    {
        show_error(
            workspace,
            t!("Running remote files is not supported yet.").into(),
            cx,
        );
        return;
    }
    if let Some(file) = buffer.read(cx).file()
        && c_runner::SourceLanguage::from_path(&file.full_path(cx)).is_none()
    {
        show_error(
            workspace,
            t!("Open a C or C++ source file to run.").into(),
            cx,
        );
        return;
    }

    let save = workspace.save_active_item(SaveIntent::SaveWithoutFormat, window, cx);
    cx.spawn_in(window, async move |workspace, cx| {
        let result: anyhow::Result<()> = async {
            save.await?;
            let source = workspace.update(cx, |_, cx| {
                let buffer = buffer.read(cx);
                // A dismissed Save As dialog must never run an older disk version.
                if buffer.is_dirty() {
                    return None;
                }
                buffer.file()?.as_local().map(|file| file.abs_path(cx))
            })?;
            let Some(source) = source else {
                return Ok(());
            };
            if c_runner::SourceLanguage::from_path(&source).is_none() {
                return Err(anyhow!(t!(
                    "Save the file with a .c or .cpp extension to run it."
                )));
            }
            let executable = std::env::current_exe()?;
            let runner = executable
                .parent()
                .context("cannot locate application directory")?
                .join(format!("lec-run{}", std::env::consts::EXE_SUFFIX));
            if !runner.is_file() {
                return Err(anyhow!(t!(
                    "The C/C++ runner is missing. Reinstall LEC Editor."
                )));
            }
            let label = t!(
                "Run {file}",
                file = source.file_name().unwrap_or_default().to_string_lossy()
            );
            let full_label = format!("{} — {}", label, source.display());
            // Paths are passed as environment values, never interpolated into shell code.
            let (shell, command) = if cfg!(windows) {
                (
                    Shell::WithArguments {
                        program: "powershell.exe".into(),
                        args: vec!["-NoLogo".into(), "-NoProfile".into()],
                        title_override: None,
                    },
                    "& $env:LEC_RUNNER $env:LEC_SOURCE; exit $LASTEXITCODE",
                )
            } else {
                (
                    Shell::Program("/bin/sh".into()),
                    "exec \"$LEC_RUNNER\" \"$LEC_SOURCE\"",
                )
            };
            let task = SpawnInTerminal {
                id: TaskId(format!("lec-run:{}", source.display())),
                label: label.to_string(),
                full_label,
                command: Some(command.into()),
                cwd: source.parent().map(ToOwned::to_owned),
                env: [
                    (
                        "LEC_RUNNER".into(),
                        runner.to_str().context("runner path is not UTF-8")?.into(),
                    ),
                    (
                        "LEC_SOURCE".into(),
                        source.to_str().context("source path is not UTF-8")?.into(),
                    ),
                ]
                .into_iter()
                .collect(),
                shell,
                reveal: RevealStrategy::Always,
                show_command: false,
                show_summary: false,
                show_rerun: false,
                ..Default::default()
            };
            let panel = workspace
                .update(cx, |workspace, cx| workspace.panel::<TerminalPanel>(cx))?
                .ok_or_else(|| {
                    anyhow!(t!("The terminal is still initializing. Try running again."))
                })?;
            // spawn_task reads the workspace, so release its mutable lease first.
            let spawn = cx.update(|window, cx| {
                panel.update(cx, |panel, cx| panel.spawn_task(&task, window, cx))
            })?;
            spawn.await?;
            Ok(())
        }
        .await;
        if let Err(error) = result {
            log::error!("Failed to run C/C++ file: {error:#}");
            workspace
                .update(cx, |workspace, cx| {
                    show_error(workspace, error.to_string(), cx)
                })
                .log_err();
        }
    })
    .detach();
}
