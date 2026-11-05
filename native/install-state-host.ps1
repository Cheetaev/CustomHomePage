param(
    [Parameter(Mandatory)]
    [ValidatePattern('^[a-p]{32}$')]
    [string]$ExtensionId
)

$ErrorActionPreference = 'Stop'
$hostName = 'com.homerep.dark_new_tab'
$hostManifest = Join-Path $PSScriptRoot 'state-host-manifest.json'
$hostBinary = Join-Path $PSScriptRoot 'state-host.exe'
$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName"
$registered = Get-Item -LiteralPath $registryPath -ErrorAction SilentlyContinue
if ($registered -and $registered.GetValue('') -ne $hostManifest) {
    throw 'The native messaging host name already points to a different installation.'
}

$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
& (Join-Path $framework 'csc.exe') /nologo /target:winexe "/out:$hostBinary" "/reference:$(Join-Path $framework 'System.Web.Extensions.dll')" (Join-Path $PSScriptRoot 'StateHost.cs')
if ($LASTEXITCODE -ne 0) {
    throw 'State host compilation failed.'
}

@{
    name = $hostName
    description = 'Saves Dark New Tab state in the extension folder'
    path = $hostBinary
    type = 'stdio'
    allowed_origins = @("chrome-extension://$ExtensionId/")
} | ConvertTo-Json | Set-Content -LiteralPath $hostManifest -Encoding Ascii

New-Item -Path $registryPath -Force | Out-Null
Set-Item -LiteralPath $registryPath -Value $hostManifest
