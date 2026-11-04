; Auto-Move Windows kurulum dosyası (Inno Setup 6)
; Derlemek için: iscc /DMyVersion=4.0.0 installer\Auto-Move.iss  (önce node build-exe.js ile dist\Auto-Move.exe oluşturulur)
; Program kullanıcının kendi klasörüne kurulur (yönetici izni gerekmez), böylece programın kendi kendini güncellemesi de çalışır.
; Veriler (akışlar, kimlik bilgileri) %USERPROFILE%\.8n8 klasöründedir; kaldırma onlara dokunmaz.

#ifndef MyVersion
  #define MyVersion "0.0.0"
#endif

[Setup]
AppId={{684BF27A-41E1-4E83-96F3-45ED9E73B12F}
AppName=Auto-Move
AppVersion={#MyVersion}
AppVerName=Auto-Move {#MyVersion}
AppPublisher=Auto-Move
AppPublisherURL=https://github.com/MustafaCanDere/AutoHook
AppSupportURL=https://github.com/MustafaCanDere/AutoHook/issues
AppUpdatesURL=https://github.com/MustafaCanDere/AutoHook/releases
DefaultDirName={localappdata}\Programs\Auto-Move
DefaultGroupName=Auto-Move
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir=..\dist
OutputBaseFilename=Auto-Move-Setup
SetupIconFile=..\public\Auto-Move.ico
UninstallDisplayIcon={app}\Auto-Move.exe
UninstallDisplayName=Auto-Move
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
CloseApplications=force
RestartApplications=no

[Languages]
Name: "tr"; MessagesFile: "compiler:Languages\Turkish.isl"

[Tasks]
Name: "masaustu"; Description: "Masaüstüne kısayol koy"; GroupDescription: "Kısayollar:"
Name: "baslangic"; Description: "Windows açılınca Auto-Move'u arka planda başlat"; GroupDescription: "Başlangıç:"; Flags: unchecked

[Files]
Source: "..\dist\Auto-Move.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\LICENSE"; DestDir: "{app}"; DestName: "LICENSE.txt"; Flags: ignoreversion

[Icons]
Name: "{group}\Auto-Move"; Filename: "{app}\Auto-Move.exe"; WorkingDir: "{app}"; Comment: "Akışlarınızı tarayıcıda açar"
Name: "{group}\Auto-Move'u kaldır"; Filename: "{uninstallexe}"
Name: "{userdesktop}\Auto-Move"; Filename: "{app}\Auto-Move.exe"; WorkingDir: "{app}"; Tasks: masaustu

[Registry]
; the same entry the program writes from Settings > "start with Windows", so the two stay in step
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "Auto-Move"; ValueData: """{app}\Auto-Move.exe"" --arka-plan"; Tasks: baslangic

[Run]
Filename: "{app}\Auto-Move.exe"; Description: "Auto-Move'u şimdi aç"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "{sys}\taskkill.exe"; Parameters: "/F /IM Auto-Move.exe"; Flags: runhidden; RunOnceId: "Kapat"
Filename: "{sys}\reg.exe"; Parameters: "delete ""HKCU\Software\Microsoft\Windows\CurrentVersion\Run"" /v Auto-Move /f"; Flags: runhidden; RunOnceId: "Baslangic"

[UninstallDelete]
Type: files; Name: "{app}\Auto-Move.exe.old"
Type: files; Name: "{app}\Auto-Move.exe.new"

[Code]
// a running copy (in the background, next to the clock) holds the exe open: close it before replacing the file
function PrepareToInstall(var NeedsRestart: Boolean): String;
var Code: Integer;
begin
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM Auto-Move.exe', '', SW_HIDE, ewWaitUntilTerminated, Code);
  Sleep(800);
  Result := '';
end;
