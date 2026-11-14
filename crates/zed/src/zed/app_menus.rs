use gpui::{App, Menu, MenuItem, OsAction};
use i18n::t;
use release_channel::ReleaseChannel;
use terminal_view::terminal_panel;
use zed_actions::{Quit, dev, project_panel};

pub fn app_menus(cx: &mut App) -> Vec<Menu> {
    let mut view_items = vec![
        MenuItem::action(
            t!("Zoom In"),
            zed_actions::IncreaseBufferFontSize { persist: false },
        ),
        MenuItem::action(
            t!("Zoom Out"),
            zed_actions::DecreaseBufferFontSize { persist: false },
        ),
        MenuItem::action(
            t!("Reset Zoom"),
            zed_actions::ResetBufferFontSize { persist: false },
        ),
        MenuItem::action(
            t!("Reset All Zoom"),
            zed_actions::ResetAllZoom { persist: false },
        ),
        MenuItem::separator(),
        MenuItem::action(t!("Toggle Left Dock"), workspace::ToggleLeftDock),
        MenuItem::action(t!("Toggle Right Dock"), workspace::ToggleRightDock),
        MenuItem::action(t!("Toggle Bottom Dock"), workspace::ToggleBottomDock),
        MenuItem::action(t!("Toggle All Docks"), workspace::ToggleAllDocks),
        MenuItem::submenu(Menu {
            name: t!("Editor Layout"),
            disabled: false,
            items: vec![
                MenuItem::action(t!("Split Up"), workspace::SplitUp::default()),
                MenuItem::action(t!("Split Down"), workspace::SplitDown::default()),
                MenuItem::action(t!("Split Left"), workspace::SplitLeft::default()),
                MenuItem::action(t!("Split Right"), workspace::SplitRight::default()),
            ],
        }),
        MenuItem::separator(),
        MenuItem::action(t!("Project Panel"), project_panel::ToggleFocus),
        MenuItem::action(t!("Outline Panel"), outline_panel::ToggleFocus),
        MenuItem::action(t!("Terminal Panel"), terminal_panel::Toggle),
    ];

    view_items.extend([
        MenuItem::separator(),
        MenuItem::action(t!("Diagnostics"), diagnostics::Deploy),
        MenuItem::separator(),
    ]);

    if ReleaseChannel::try_global(cx) == Some(ReleaseChannel::Dev) {
        view_items.push(MenuItem::action(
            t!("Toggle GPUI Inspector"),
            dev::ToggleInspector,
        ));
        view_items.push(MenuItem::separator());
    }

    vec![
        Menu {
            name: t!("line"),
            disabled: false,
            items: vec![
                MenuItem::action(t!("About line"), zed_actions::About),
                MenuItem::action(t!("Check for Updates"), auto_update::Check),
                MenuItem::separator(),
                MenuItem::submenu(Menu::new(t!("Settings")).items([
                    MenuItem::action(t!("Open Settings"), zed_actions::OpenSettings),
                    MenuItem::action(t!("Open Settings File"), super::OpenSettingsFile),
                    MenuItem::action(
                        t!("Open Project Settings"),
                        zed_actions::OpenProjectSettings,
                    ),
                    MenuItem::action(
                        t!("Open Project Settings File"),
                        super::OpenProjectSettingsFile,
                    ),
                    MenuItem::action(t!("Open Default Settings"), super::OpenDefaultSettings),
                    MenuItem::separator(),
                    MenuItem::action(t!("Open Keymap"), zed_actions::OpenKeymap),
                    MenuItem::action(t!("Open Keymap File"), zed_actions::OpenKeymapFile),
                    MenuItem::action(
                        t!("Open Default Key Bindings"),
                        zed_actions::OpenDefaultKeymap,
                    ),
                    MenuItem::separator(),
                    MenuItem::action(
                        t!("Select Theme..."),
                        zed_actions::theme_selector::Toggle::default(),
                    ),
                    MenuItem::action(
                        t!("Select Icon Theme..."),
                        zed_actions::icon_theme_selector::Toggle::default(),
                    ),
                ])),
                MenuItem::separator(),
                #[cfg(target_os = "macos")]
                MenuItem::os_submenu(t!("Services"), gpui::SystemMenuType::Services),
                MenuItem::separator(),
                MenuItem::action(t!("Extensions"), zed_actions::Extensions::default()),
                #[cfg(not(target_os = "windows"))]
                MenuItem::action(t!("Install CLI"), install_cli::InstallCliBinary),
                MenuItem::separator(),
                #[cfg(target_os = "macos")]
                MenuItem::action(t!("Hide line"), super::Hide),
                #[cfg(target_os = "macos")]
                MenuItem::action(t!("Hide Others"), super::HideOthers),
                #[cfg(target_os = "macos")]
                MenuItem::action(t!("Show All"), super::ShowAll),
                MenuItem::separator(),
                MenuItem::action(t!("Quit line"), Quit),
            ],
        },
        Menu {
            name: t!("File"),
            disabled: false,
            items: vec![
                MenuItem::action(t!("New"), workspace::NewFile),
                MenuItem::action(t!("New Window"), workspace::NewWindow),
                MenuItem::separator(),
                #[cfg(not(target_os = "macos"))]
                MenuItem::action(t!("Open File..."), workspace::OpenFiles),
                MenuItem::action(
                    if cfg!(not(target_os = "macos")) {
                        t!("Open Folder...")
                    } else {
                        t!("Open…")
                    },
                    workspace::Open::default(),
                ),
                MenuItem::action(t!("Open Recent…"), zed_actions::OpenRecent::default()),
                MenuItem::action(t!("Open Remote…"), zed_actions::OpenRemote::default()),
                MenuItem::separator(),
                MenuItem::action(t!("Add Folder to Project…"), workspace::AddFolderToProject),
                MenuItem::separator(),
                MenuItem::action(t!("Save"), workspace::Save { save_intent: None }),
                MenuItem::action(t!("Save As…"), workspace::SaveAs),
                MenuItem::action(t!("Save All"), workspace::SaveAll { save_intent: None }),
                MenuItem::separator(),
                MenuItem::action(
                    t!("Close Editor"),
                    workspace::CloseActiveItem {
                        save_intent: None,
                        close_pinned: true,
                    },
                ),
                MenuItem::action(t!("Close Project"), workspace::CloseProject),
                MenuItem::action(t!("Close Window"), workspace::CloseWindow),
            ],
        },
        Menu {
            name: t!("Edit"),
            disabled: false,
            items: vec![
                MenuItem::os_action(t!("Undo"), editor::actions::Undo, OsAction::Undo),
                MenuItem::os_action(t!("Redo"), editor::actions::Redo, OsAction::Redo),
                MenuItem::separator(),
                MenuItem::os_action(t!("Cut"), editor::actions::Cut, OsAction::Cut),
                MenuItem::os_action(t!("Copy"), editor::actions::Copy, OsAction::Copy),
                MenuItem::action(t!("Copy and Trim"), editor::actions::CopyAndTrim),
                MenuItem::os_action(t!("Paste"), editor::actions::Paste, OsAction::Paste),
                MenuItem::separator(),
                MenuItem::action(t!("Find"), search::buffer_search::Deploy::find()),
                MenuItem::action(t!("Find in Project"), workspace::DeploySearch::default()),
                MenuItem::separator(),
                MenuItem::action(
                    t!("Toggle Line Comment"),
                    editor::actions::ToggleComments::default(),
                ),
            ],
        },
        Menu {
            name: t!("Selection"),
            disabled: false,
            items: vec![
                MenuItem::os_action(
                    t!("Select All"),
                    editor::actions::SelectAll,
                    OsAction::SelectAll,
                ),
                MenuItem::action(
                    t!("Expand Selection"),
                    editor::actions::SelectLargerSyntaxNode,
                ),
                MenuItem::action(
                    t!("Shrink Selection"),
                    editor::actions::SelectSmallerSyntaxNode,
                ),
                MenuItem::action(
                    t!("Select Next Sibling"),
                    editor::actions::SelectNextSyntaxNode,
                ),
                MenuItem::action(
                    t!("Select Previous Sibling"),
                    editor::actions::SelectPreviousSyntaxNode,
                ),
                MenuItem::separator(),
                MenuItem::action(
                    t!("Add Cursor Above"),
                    editor::actions::AddSelectionAbove {
                        skip_soft_wrap: true,
                    },
                ),
                MenuItem::action(
                    t!("Add Cursor Below"),
                    editor::actions::AddSelectionBelow {
                        skip_soft_wrap: true,
                    },
                ),
                MenuItem::action(
                    t!("Select Next Occurrence"),
                    editor::actions::SelectNext {
                        replace_newest: false,
                    },
                ),
                MenuItem::action(
                    t!("Select Previous Occurrence"),
                    editor::actions::SelectPrevious {
                        replace_newest: false,
                    },
                ),
                MenuItem::action(
                    t!("Select All Occurrences"),
                    editor::actions::SelectAllMatches,
                ),
                MenuItem::separator(),
                MenuItem::action(t!("Move Line Up"), editor::actions::MoveLineUp),
                MenuItem::action(t!("Move Line Down"), editor::actions::MoveLineDown),
                MenuItem::action(
                    t!("Duplicate Selection"),
                    editor::actions::DuplicateLineDown,
                ),
            ],
        },
        Menu {
            name: t!("View"),
            disabled: false,
            items: view_items,
        },
        Menu {
            name: t!("Go"),
            disabled: false,
            items: vec![
                MenuItem::action(t!("Back"), workspace::GoBack),
                MenuItem::action(t!("Forward"), workspace::GoForward),
                MenuItem::separator(),
                MenuItem::action(
                    t!("Command Palette..."),
                    zed_actions::command_palette::Toggle,
                ),
                MenuItem::separator(),
                MenuItem::action(t!("Go to File..."), workspace::ToggleFileFinder::default()),
                // MenuItem::action(t!("Go to Symbol in Project"), project_symbols::Toggle),
                MenuItem::action(
                    t!("Go to Symbol in Editor..."),
                    zed_actions::outline::ToggleOutline,
                ),
                MenuItem::action(t!("Go to Line/Column..."), editor::actions::ToggleGoToLine),
                MenuItem::separator(),
                MenuItem::action(
                    t!("Go to Definition"),
                    editor::actions::GoToDefinition::default(),
                ),
                MenuItem::action(
                    t!("Go to Declaration"),
                    editor::actions::GoToDeclaration::default(),
                ),
                MenuItem::action(
                    t!("Go to Type Definition"),
                    editor::actions::GoToTypeDefinition::default(),
                ),
                MenuItem::action(
                    t!("Find All References"),
                    editor::actions::FindAllReferences::default(),
                ),
                MenuItem::action(t!("Show Incoming Calls"), call_hierarchy::ShowIncomingCalls),
                MenuItem::action(t!("Show Outgoing Calls"), call_hierarchy::ShowOutgoingCalls),
                MenuItem::separator(),
                MenuItem::action(
                    t!("Next Problem"),
                    editor::actions::GoToDiagnostic::default(),
                ),
                MenuItem::action(
                    t!("Previous Problem"),
                    editor::actions::GoToPreviousDiagnostic::default(),
                ),
            ],
        },
        Menu {
            name: t!("Run"),
            disabled: false,
            items: vec![
                MenuItem::action(t!("Run Current File"), zed_actions::RunCurrentFile),
                MenuItem::action(t!("Debug Current File"), zed_actions::DebugCurrentFile),
                MenuItem::action(t!("Continue Program"), debugger_ui::Continue),
                MenuItem::action(t!("Step Over"), debugger_ui::StepOver),
                MenuItem::action(t!("Step In"), debugger_ui::StepInto),
                MenuItem::action(t!("Step Out"), debugger_ui::StepOut),
                MenuItem::action(t!("Stop Debugging"), debugger_ui::Stop),
                MenuItem::separator(),
                MenuItem::action(t!("Debug Panel"), zed_actions::debug_panel::ToggleFocus),
                MenuItem::action(t!("Terminal Panel"), terminal_panel::Toggle),
            ],
        },
        Menu {
            name: t!("Window"),
            disabled: false,
            items: vec![
                MenuItem::action(t!("Minimize"), super::Minimize),
                MenuItem::action(t!("Zoom"), super::Zoom),
                MenuItem::separator(),
            ],
        },
        Menu {
            name: t!("Help"),
            disabled: false,
            items: vec![
                MenuItem::action(
                    t!("line Repository"),
                    super::OpenBrowser {
                        url: "https://github.com/lec-org/lec-editor".into(),
                    },
                ),
                MenuItem::action(
                    t!("Report a Problem"),
                    super::OpenBrowser {
                        url: "https://github.com/lec-org/lec-editor/issues".into(),
                    },
                ),
                MenuItem::action(t!("View Dependency Licenses"), zed_actions::OpenLicenses),
            ],
        },
    ]
}
