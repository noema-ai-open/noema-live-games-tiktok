; Inno-Setup-Skript — wird im CI auf einem Windows-Runner mit ISCC gebaut.
; Der Installer enthält nur die gebaute Weboberfläche und ein PowerShell-Skript.
; Es wird keine Laufzeitumgebung mitgeliefert, weil der Webserver aus dem in
; Windows eingebauten System.Net.HttpListener besteht.
#define AppName "NOEMA-AI Ascent"
#define AppVersion GetEnv("APP_VERSION")
#if AppVersion == ""
  #define AppVersion "0.0.0"
#endif

[Setup]
AppId={{B4E7A1D2-3F60-4C18-9A72-5D0E6C4B8A31}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=NOEMA
AppSupportURL=https://github.com/noema-ai-open/noema-live-games-tiktok
DefaultDirName={autopf}\NOEMA-AI Ascent
DefaultGroupName=NOEMA
DisableProgramGroupPage=yes
OutputDir=Output
OutputBaseFilename=NOEMA-AI-Ascent-Setup
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
SetupLogging=yes
UninstallDisplayName={#AppName} v{#AppVersion}

[Languages]
Name: "german"; MessagesFile: "compiler:Languages\German.isl"

[InstallDelete]
; Alte Spieldateien entfernen, damit nach einem Update keine Reste bleiben.
Type: filesandordirs; Name: "{app}\app"

[Files]
Source: "..\apps\game\dist\*"; DestDir: "{app}\app"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "serve.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "LIESMICH.txt"; DestDir: "{app}"; Flags: ignoreversion isreadme

[Icons]
Name: "{group}\NOEMA-AI Ascent"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\serve.ps1"" -View operator"; \
  WorkingDir: "{app}"; Comment: "Startet NOEMA-AI Ascent und oeffnet die Steuerung"
Name: "{autodesktop}\NOEMA-AI Ascent"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\serve.ps1"" -View operator"; \
  WorkingDir: "{app}"; Comment: "Startet NOEMA-AI Ascent und oeffnet die Steuerung"; \
  Tasks: desktopicon
Name: "{group}\NOEMA-AI Ascent deinstallieren"; Filename: "{uninstallexe}"

[Tasks]
Name: "desktopicon"; Description: "Verknuepfung auf dem Desktop anlegen"; \
  GroupDescription: "Zusaetzliche Verknuepfungen:"

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\serve.ps1"" -View operator"; \
  WorkingDir: "{app}"; Description: "NOEMA-AI Ascent jetzt starten"; \
  Flags: nowait postinstall skipifsilent
