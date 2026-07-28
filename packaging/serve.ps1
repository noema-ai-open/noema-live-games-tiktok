<#
.SYNOPSIS
  Startet NOEMA Ascent lokal und öffnet die Operator-Ansicht im Browser.

.DESCRIPTION
  Kleiner statischer Webserver auf Basis von System.Net.HttpListener. Der ist
  fest in Windows eingebaut, deshalb braucht die installierte Version weder
  Node.js noch Python.

  Der Server lauscht ausschließlich auf localhost. Es gibt keine Anmeldung und
  keine Netzwerkfreigabe, weil die Seite nur für diesen Rechner gedacht ist.

.PARAMETER Port
  Startport. Ist er belegt, werden die nächsten Ports probiert.

.PARAMETER Root
  Ordner mit den gebauten Dateien. Standard: Unterordner "app" neben diesem
  Skript.

.PARAMETER View
  Welche Ansicht beim Start geöffnet wird: operator, stream oder none.

.PARAMETER NoBrowser
  Öffnet keinen Browser. Wird vom CI-Rauchtest benutzt.
#>
[CmdletBinding()]
param(
  [int]$Port = 4173,
  [string]$Root = (Join-Path $PSScriptRoot "app"),
  [ValidateSet("operator", "stream", "none")]
  [string]$View = "operator",
  [switch]$NoBrowser,
  [int]$StopAfterSeconds = 0
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $Root)) {
  Write-Error "Ordner mit den Spieldateien nicht gefunden: $Root"
  exit 1
}
$rootFull = (Resolve-Path -LiteralPath $Root).Path

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".mjs"  = "text/javascript; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".webp" = "image/webp"
  ".ico"  = "image/x-icon"
  ".woff" = "font/woff"
  ".woff2" = "font/woff2"
  ".map"  = "application/json; charset=utf-8"
  ".txt"  = "text/plain; charset=utf-8"
}

function Get-ContentType([string]$path) {
  $extension = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
  if ($mimeTypes.ContainsKey($extension)) { return $mimeTypes[$extension] }
  return "application/octet-stream"
}

# Verhindert, dass eine manipulierte URL Dateien außerhalb des Ordners liest.
function Resolve-RequestPath([string]$urlPath) {
  $relative = [Uri]::UnescapeDataString($urlPath).TrimStart("/")
  if ([string]::IsNullOrWhiteSpace($relative)) { $relative = "index.html" }
  $relative = $relative -replace "/", "\"
  $candidate = [System.IO.Path]::GetFullPath((Join-Path $rootFull $relative))
  if (-not $candidate.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }
  if (Test-Path -LiteralPath $candidate -PathType Container) {
    $candidate = Join-Path $candidate "index.html"
  }
  return $candidate
}

$listener = [System.Net.HttpListener]::new()
$boundPort = 0
foreach ($candidatePort in $Port..($Port + 9)) {
  try {
    $listener.Prefixes.Clear()
    # "localhost" ist der einzige Präfix, den Windows ohne Administratorrechte
    # erlaubt. Damit bleibt der Server auch ohne UAC-Abfrage startbar.
    $listener.Prefixes.Add("http://localhost:$candidatePort/")
    $listener.Start()
    $boundPort = $candidatePort
    break
  } catch [System.Net.HttpListenerException] {
    $listener.Close()
    $listener = [System.Net.HttpListener]::new()
    continue
  }
}

if ($boundPort -eq 0) {
  Write-Error "Kein freier Port zwischen $Port und $($Port + 9). Läuft NOEMA Ascent schon?"
  exit 1
}

$baseUrl = "http://localhost:$boundPort"
$streamUrl = "$baseUrl/?view=stream&autostart=1"
$operatorUrl = "$baseUrl/?view=operator"

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
  Start-Process $target | Out-Null
}

$deadline = if ($StopAfterSeconds -gt 0) {
  (Get-Date).AddSeconds($StopAfterSeconds)
} else {
  [DateTime]::MaxValue
}

try {
  while ($listener.IsListening -and (Get-Date) -lt $deadline) {
    $contextTask = $listener.GetContextAsync()
    while (-not $contextTask.AsyncWaitHandle.WaitOne(250)) {
      if ((Get-Date) -ge $deadline) { break }
    }
    if (-not $contextTask.IsCompleted) { break }

    $context = $contextTask.GetAwaiter().GetResult()
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
      $response.StatusCode = 500
    } finally {
      $response.OutputStream.Close()
    }
  }
} finally {
  if ($listener.IsListening) { $listener.Stop() }
  $listener.Close()
}
