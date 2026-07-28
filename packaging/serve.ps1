<#
.SYNOPSIS
  Startet NOEMA Ascent lokal und oeffnet die Operator-Ansicht im Browser.

.DESCRIPTION
  Kleiner statischer Webserver auf Basis von System.Net.HttpListener. Der ist
  fest in Windows eingebaut, deshalb braucht die installierte Version weder
  Node.js noch Python.

  Der Server lauscht ausschliesslich auf localhost. Es gibt keine Anmeldung und
  keine Netzwerkfreigabe, weil die Seite nur fuer diesen Rechner gedacht ist.

  Das Skript muss unter Windows PowerShell 5.1 laufen, nicht nur unter
  PowerShell 7 — die Startmenue-Verknuepfung benutzt 5.1. Deshalb wird hier
  bewusst kein async/await verwendet: Task.AsyncWaitHandle ist eine explizit
  implementierte Schnittstelle und in 5.1 nicht erreichbar.

.PARAMETER Port
  Startport. Ist er belegt, werden die naechsten Ports probiert.

.PARAMETER Root
  Ordner mit den gebauten Dateien. Standard: Unterordner "app" neben diesem
  Skript.

.PARAMETER View
  Welche Ansicht beim Start geoeffnet wird: operator, stream oder none.

.PARAMETER NoBrowser
  Oeffnet keinen Browser und wartet im Fehlerfall nicht auf eine Eingabe.
  Wird vom CI-Rauchtest benutzt.
#>
[CmdletBinding()]
param(
  [int]$Port = 4173,
  [string]$Root = (Join-Path $PSScriptRoot "app"),
  [ValidateSet("operator", "stream", "none")]
  [string]$View = "operator",
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

# --- Protokoll -------------------------------------------------------------
# Damit ein Fehlstart nachvollziehbar bleibt, auch wenn das Fenster zugeht.
$logBase = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { $env:TEMP }
$logDirectory = Join-Path $logBase "NOEMA\Ascent"
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$logFile = Join-Path $logDirectory "start.log"

function Write-Log([string]$message) {
  $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $message
  try { Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8 } catch { }
}

function Stop-WithError([string]$message, $errorRecord) {
  Write-Log "FEHLER: $message"
  if ($errorRecord) { Write-Log $errorRecord.ToString() }
  Write-Host ""
  Write-Host "  NOEMA Ascent konnte nicht starten." -ForegroundColor Red
  Write-Host "  $message" -ForegroundColor Red
  if ($errorRecord) { Write-Host "  $errorRecord" -ForegroundColor DarkRed }
  Write-Host ""
  Write-Host "  Protokoll: $logFile" -ForegroundColor DarkGray
  Write-Host ""
  if (-not $NoBrowser) { Read-Host "  Zum Schliessen die Eingabetaste druecken" | Out-Null }
  exit 1
}

Write-Log "Start: PSVersion=$($PSVersionTable.PSVersion) Root=$Root Port=$Port View=$View"

if (-not (Test-Path -LiteralPath $Root)) {
  Stop-WithError "Ordner mit den Spieldateien nicht gefunden: $Root" $null
}
$rootFull = (Resolve-Path -LiteralPath $Root).Path

$mimeTypes = @{
  ".html"  = "text/html; charset=utf-8"
  ".js"    = "text/javascript; charset=utf-8"
  ".mjs"   = "text/javascript; charset=utf-8"
  ".css"   = "text/css; charset=utf-8"
  ".json"  = "application/json; charset=utf-8"
  ".svg"   = "image/svg+xml"
  ".png"   = "image/png"
  ".jpg"   = "image/jpeg"
  ".jpeg"  = "image/jpeg"
  ".webp"  = "image/webp"
  ".ico"   = "image/x-icon"
  ".woff"  = "font/woff"
  ".woff2" = "font/woff2"
  ".map"   = "application/json; charset=utf-8"
  ".txt"   = "text/plain; charset=utf-8"
}

function Get-ContentType([string]$path) {
  $extension = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
  if ($mimeTypes.ContainsKey($extension)) { return $mimeTypes[$extension] }
  return "application/octet-stream"
}

# Verhindert, dass eine manipulierte URL Dateien ausserhalb des Ordners liest.
function Resolve-RequestPath([string]$urlPath) {
  $relative = [Uri]::UnescapeDataString($urlPath).TrimStart("/")
  if ([string]::IsNullOrWhiteSpace($relative)) { $relative = "index.html" }
  $relative = $relative -replace "/", "\"
  try {
    $candidate = [System.IO.Path]::GetFullPath((Join-Path $rootFull $relative))
  } catch {
    return $null
  }
  if (-not $candidate.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }
  if (Test-Path -LiteralPath $candidate -PathType Container) {
    $candidate = Join-Path $candidate "index.html"
  }
  return $candidate
}

# --- Server starten --------------------------------------------------------
$listener = New-Object System.Net.HttpListener
$boundPort = 0
$lastError = $null
foreach ($candidatePort in $Port..($Port + 9)) {
  try {
    $listener.Prefixes.Clear()
    # "localhost" ist der einzige Praefix, den Windows ohne Administratorrechte
    # erlaubt. Damit bleibt der Server auch ohne UAC-Abfrage startbar.
    $listener.Prefixes.Add("http://localhost:$candidatePort/")
    $listener.Start()
    $boundPort = $candidatePort
    break
  } catch {
    $lastError = $_
    Write-Log "Port $candidatePort nicht nutzbar: $_"
    try { $listener.Close() } catch { }
    $listener = New-Object System.Net.HttpListener
  }
}

if ($boundPort -eq 0) {
  Stop-WithError "Kein freier Port zwischen $Port und $($Port + 9). Laeuft NOEMA Ascent schon?" $lastError
}

$baseUrl = "http://localhost:$boundPort"
$streamUrl = "$baseUrl/?view=stream&autostart=1"
$operatorUrl = "$baseUrl/?view=operator"
Write-Log "Server laeuft auf $baseUrl"

Write-Host ""
Write-Host "  NOEMA Ascent laeuft." -ForegroundColor Green
Write-Host ""
Write-Host "  Operator (Steuerung):  $operatorUrl"
Write-Host "  Stream (fuer LIVE Studio / OBS):"
Write-Host "  $streamUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "  In TikTok LIVE Studio: Quelle hinzufuegen -> Link -> obige Stream-URL"
Write-Host "  Quellgroesse 720 x 1280 einstellen."
Write-Host ""
Write-Host "  Dieses Fenster offen lassen. Zum Beenden schliessen oder Strg+C." -ForegroundColor DarkGray
Write-Host ""

if (-not $NoBrowser -and $View -ne "none") {
  $target = if ($View -eq "stream") { $streamUrl } else { $operatorUrl }
  try { Start-Process $target | Out-Null } catch { Write-Log "Browser konnte nicht geoeffnet werden: $_" }
}

# --- Anfragen bedienen -----------------------------------------------------
# Blockierendes GetContext(): laeuft unveraendert unter Windows PowerShell 5.1.
try {
  while ($listener.IsListening) {
    try {
      $context = $listener.GetContext()
    } catch {
      break
    }

    $response = $context.Response
    try {
      $path = Resolve-RequestPath $context.Request.Url.AbsolutePath
      if ($null -ne $path -and (Test-Path -LiteralPath $path -PathType Leaf)) {
        $bytes = [System.IO.File]::ReadAllBytes($path)
        $response.ContentType = Get-ContentType $path
        $response.ContentLength64 = $bytes.Length
        # Kein Caching: nach einem Update soll sofort die neue Fassung laufen.
        $response.Headers.Add("Cache-Control", "no-store")
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $response.StatusCode = 404
        $message = [System.Text.Encoding]::UTF8.GetBytes("Nicht gefunden")
        $response.ContentType = "text/plain; charset=utf-8"
        $response.ContentLength64 = $message.Length
        $response.OutputStream.Write($message, 0, $message.Length)
      }
    } catch {
      Write-Log "Anfragefehler: $_"
      try { $response.StatusCode = 500 } catch { }
    } finally {
      try { $response.OutputStream.Close() } catch { }
    }
  }
} finally {
  Write-Log "Server beendet."
  try { if ($listener.IsListening) { $listener.Stop() } } catch { }
  try { $listener.Close() } catch { }
}
