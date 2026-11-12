; LEC identity is intentionally independent of Zed and Wu.
; Keep AppMutex in sync with release_channel::app_identifier() for stable builds.
[Setup]
AppId={{9A7293B9-052B-4807-8DCB-E6C4B1A93D58}
AppName=LEC Editor
AppVersion={#AppVersion}
AppPublisher=LEC
AppPublisherURL=https://github.com/lec-org/lec-editor
AppSupportURL=https://github.com/lec-org/lec-editor/issues
AppUpdatesURL=https://github.com/lec-org/lec-editor/releases
DefaultDirName={localappdata}\Programs\LECEditor
DefaultGroupName=LEC Editor
PrivilegesRequired=lowest
DisableProgramGroupPage=yes
OutputDir={#OutputDir}
OutputBaseFilename=LECEditor-{#AppVersion}-{#Architecture}-Setup
SourceDir={#SourceDir}
UninstallDisplayIcon={app}\leceditor.exe
AppMutex=LEC-Editor-Stable-Instance-Mutex
SetupMutex=LEC-Editor-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ChangesAssociations=yes
MinVersion=10.0.17763
#if Architecture == "aarch64"
ArchitecturesAllowed=arm64
ArchitecturesInstallIn64BitMode=arm64
#else
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
#endif

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "simplifiedChinese"; MessagesFile: "messages\Default.zh-cn.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; Flags: unchecked

[Files]
Source: "*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs

[Icons]
Name: "{group}\LEC Editor"; Filename: "{app}\leceditor.exe"; AppUserModelID: "org.lec.Editor"
Name: "{autodesktop}\LEC Editor"; Filename: "{app}\leceditor.exe"; Tasks: desktopicon; AppUserModelID: "org.lec.Editor"

[Registry]
Root: HKCU; Subkey: "Software\Classes\LECEditor.Source"; ValueType: string; ValueName: ""; ValueData: "C/C++ Source File"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\LECEditor.Source\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\leceditor.exe"" ""%1"""; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\.c\OpenWithProgids"; ValueType: string; ValueName: "LECEditor.Source"; ValueData: ""; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Classes\.cpp\OpenWithProgids"; ValueType: string; ValueName: "LECEditor.Source"; ValueData: ""; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Classes\.h\OpenWithProgids"; ValueType: string; ValueName: "LECEditor.Source"; ValueData: ""; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Classes\.hpp\OpenWithProgids"; ValueType: string; ValueName: "LECEditor.Source"; ValueData: ""; Flags: uninsdeletevalue

[Run]
Filename: "{app}\leceditor.exe"; Description: "{cm:LaunchProgram,LEC Editor}"; Flags: nowait postinstall skipifsilent
