; LEC identity is intentionally independent of Zed and Wu.
; Keep AppMutex in sync with release_channel::app_identifier() for stable builds.
[Setup]
AppId={{9A7293B9-052B-4807-8DCB-E6C4B1A93D58}
AppName=Line
AppVersion={#AppVersion}
AppPublisher=LEC
AppPublisherURL=https://github.com/lec-org/lec-editor
AppSupportURL=https://github.com/lec-org/lec-editor/issues
AppUpdatesURL=https://github.com/lec-org/lec-editor/releases
DefaultDirName={localappdata}\Programs\LECEditor
DefaultGroupName=Line
PrivilegesRequired=lowest
DisableProgramGroupPage=yes
OutputDir={#OutputDir}
OutputBaseFilename=line-{#AppVersion}-{#Architecture}-Setup
SourceDir={#SourceDir}
UninstallDisplayIcon={app}\leceditor.exe
SetupIconFile={#SourcePath}app-icon.ico
AppMutex=LEC-Editor-Stable-Instance-Mutex
SetupMutex=LEC-Editor-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ChangesAssociations=yes
ChangesEnvironment=yes
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
Name: "simplifiedChinese"; MessagesFile: "{#SourcePath}messages\Default.zh-cn.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; Flags: unchecked

[Files]
Source: "*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs

[Icons]
Name: "{group}\Line"; Filename: "{app}\leceditor.exe"; AppUserModelID: "org.lec.Editor"
Name: "{autodesktop}\Line"; Filename: "{app}\leceditor.exe"; Tasks: desktopicon; AppUserModelID: "org.lec.Editor"

[Registry]
Root: HKCU; Subkey: "Software\Classes\LECEditor.Source"; ValueType: string; ValueName: ""; ValueData: "C/C++ Source File"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\LECEditor.Source\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\leceditor.exe"" ""%1"""; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\.c\OpenWithProgids"; ValueType: string; ValueName: "LECEditor.Source"; ValueData: ""; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Classes\.cpp\OpenWithProgids"; ValueType: string; ValueName: "LECEditor.Source"; ValueData: ""; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Classes\.h\OpenWithProgids"; ValueType: string; ValueName: "LECEditor.Source"; ValueData: ""; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Classes\.hpp\OpenWithProgids"; ValueType: string; ValueName: "LECEditor.Source"; ValueData: ""; Flags: uninsdeletevalue

[Run]
Filename: "{app}\leceditor.exe"; Description: "{cm:LaunchProgram,Line}"; Flags: nowait postinstall skipifsilent

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var
  UserPath, CliPath: string;
begin
  if CurStep <> ssPostInstall then exit;
  CliPath := ExpandConstant('{app}\bin');
  RegQueryStringValue(HKCU, 'Environment', 'Path', UserPath);
  if Pos(';' + Uppercase(CliPath) + ';', ';' + Uppercase(UserPath) + ';') > 0 then exit;
  if (UserPath <> '') and (Copy(UserPath, Length(UserPath), 1) <> ';') then
    UserPath := UserPath + ';';
  if not RegWriteExpandStringValue(HKCU, 'Environment', 'Path', UserPath + CliPath) then
    RaiseException('无法将 line 命令添加到用户 PATH');
  if not RegWriteDWordValue(HKCU, 'Software\LEC\Editor', 'CliPathAdded', 1) then
    RaiseException('无法记录 line 命令的安装状态');
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  UserPath, CliPath: string;
  Added: Cardinal;
  Position: Integer;
begin
  if CurUninstallStep <> usUninstall then exit;
  { 仅撤销安装器自己添加的条目，保留用户原有 PATH。 }
  if not RegQueryDWordValue(HKCU, 'Software\LEC\Editor', 'CliPathAdded', Added) then exit;
  if Added <> 1 then exit;
  if not RegQueryStringValue(HKCU, 'Environment', 'Path', UserPath) then exit;
  CliPath := ExpandConstant('{app}\bin');
  UserPath := ';' + UserPath + ';';
  repeat
    Position := Pos(';' + Uppercase(CliPath) + ';', Uppercase(UserPath));
    if Position > 0 then Delete(UserPath, Position, Length(CliPath) + 1);
  until Position = 0;
  if Length(UserPath) > 1 then
    UserPath := Copy(UserPath, 2, Length(UserPath) - 2)
  else
    UserPath := '';
  if not RegWriteExpandStringValue(HKCU, 'Environment', 'Path', UserPath) then
    RaiseException('无法从用户 PATH 移除 line 命令');
  if not RegDeleteValue(HKCU, 'Software\LEC\Editor', 'CliPathAdded') then
    Log('无法清除 line 命令的安装标记');
end;
