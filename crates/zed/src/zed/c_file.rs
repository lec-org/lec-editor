use anyhow::{Context as _, anyhow};
use debugger_ui::debugger_panel::DebugPanel;
use editor::Editor;
use gpui::{Context, Window};
use i18n::t;
use task::{
    BuildTaskDefinition, DebugScenario, RevealStrategy, Shell, SpawnInTerminal, TaskContext,
    TaskId, TaskTemplate,
};
use terminal_view::terminal_panel::TerminalPanel;
use util::ResultExt as _;
use workspace::{SaveIntent, Toast, Workspace, notifications::NotificationId};
use zed_actions::{DebugCurrentFile, RunCurrentFile};

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
    run_current_file(workspace, false, window, cx);
}

pub fn debug(
    workspace: &mut Workspace,
    _: &DebugCurrentFile,
    window: &mut Window,
    cx: &mut Context<Workspace>,
) {
    run_current_file(workspace, true, window, cx);
}

fn run_current_file(
    workspace: &mut Workspace,
    debugging: bool,
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
                return Err(anyhow!(t!("The C/C++ runner is missing. Reinstall line.")));
            }
            let file = source.file_name().unwrap_or_default().to_string_lossy();
            let label = if debugging { t!("Debug {file}", file = file) } else { t!("Run {file}", file = file) };
            let full_label = format!("{} — {}", label, source.display());
            // Paths are passed as environment values, never interpolated into shell code.
            let (shell, command) = if cfg!(windows) {
                (
                    Shell::WithArguments {
                        program: "powershell.exe".into(),
                        args: vec!["-NoLogo".into(), "-NoProfile".into()],
                        title_override: None,
                    },
                    if debugging {
                        "& $env:LEC_RUNNER --compile-only $env:LEC_SOURCE $env:LEC_PROGRAM; exit $LASTEXITCODE"
                    } else {
                        "& $env:LEC_RUNNER $env:LEC_SOURCE; exit $LASTEXITCODE"
                    },
                )
            } else {
                (
                    Shell::Program("/bin/sh".into()),
                    if debugging {
                        "exec \"$LEC_RUNNER\" --compile-only \"$LEC_SOURCE\" \"$LEC_PROGRAM\""
                    } else {
                        "exec \"$LEC_RUNNER\" \"$LEC_SOURCE\""
                    },
                )
            };
            let mut environment: collections::HashMap<String, String> = [
                ("LEC_RUNNER".into(), runner.to_str().context("runner path is not UTF-8")?.into()),
                ("LEC_SOURCE".into(), source.to_str().context("source path is not UTF-8")?.into()),
            ].into_iter().collect();
            if debugging {
                let adapter = executable.parent().context("cannot locate application directory")?
                    .join("toolchains/codelldb/adapter")
                    .join(format!("codelldb{}", std::env::consts::EXE_SUFFIX));
                if !adapter.is_file() {
                    return Err(anyhow!(t!("The C/C++ debugger is missing. Reinstall line.")));
                }
                let already_running = workspace.update(cx, |workspace, cx| {
                    workspace.project().read(cx).dap_store().read(cx).sessions()
                        .any(|session| !session.read(cx).is_terminated())
                })?;
                if already_running {
                    return Err(anyhow!(t!("Stop the current debug session before starting another.")));
                }
                // shortcut: 系统临时目录保留调试产物以支持重新调试；引入会话缓存管理时统一清理。
                let program = std::env::temp_dir().join(format!("line-debug-{}", uuid::Uuid::new_v4()))
                    .join(format!("program{}", std::env::consts::EXE_SUFFIX));
                environment.insert("LEC_PROGRAM".into(), program.to_str().context("debug path is not UTF-8")?.into());
                let scenario = DebugScenario {
                    adapter: "CodeLLDB".into(),
                    label,
                    build: Some(BuildTaskDefinition::Template {
                        task_template: TaskTemplate {
                            label: t!("Compile for debugging").to_string(),
                            command: command.into(),
                            env: environment,
                            shell,
                            cwd: source.parent().and_then(|path| path.to_str()).map(ToOwned::to_owned),
                            show_command: false,
                            show_summary: false,
                            ..Default::default()
                        },
                        locator_name: None,
                    }),
                    config: serde_json::json!({
                        "request": "launch", "program": program, "cwd": source.parent(),
                        "stopOnEntry": false, "terminal": "integrated",
                        "preRunCommands": ["breakpoint set --name main --one-shot true"],
                    }),
                    tcp_connection: None,
                };
                let task_context = TaskContext { cwd: source.parent().map(ToOwned::to_owned), ..Default::default() }.into();
                let panel = workspace.update_in(cx, |workspace, window, cx| workspace.focus_panel::<DebugPanel>(window, cx))?
                    .ok_or_else(|| anyhow!(t!("The debugger is still initializing. Try again.")))?;
                panel.update_in(cx, |panel, window, cx| {
                    panel.start_session(scenario, task_context, Some(buffer.clone()), None, window, cx);
                })?;
                return Ok(());
            }
            let task = SpawnInTerminal {
                id: TaskId(format!("lec-run:{}", source.display())),
                label: label.to_string(),
                full_label,
                command: Some(command.into()),
                cwd: source.parent().map(ToOwned::to_owned),
                env: environment,
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
