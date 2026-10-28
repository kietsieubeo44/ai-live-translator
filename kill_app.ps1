# Kill ai-live-translator
Get-Process -Name "ai-live-translator" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Kill any msedgewebview2 associated with com.ailivetranslator.app
try {
    Get-CimInstance Win32_Process -Filter "name = 'msedgewebview2.exe'" | ForEach-Object {
        if ($_.CommandLine -like "*com.ailivetranslator.app*") {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
} catch {
    # Fallback: kill any stray msedgewebview2 if needed
}

# Wait for file locks to release
Start-Sleep -Milliseconds 800

# Remove EBWebView Lock files
$lockPath = "$env:LOCALAPPDATA\com.ailivetranslator.app\EBWebView\Default\LOCK"
if (Test-Path $lockPath) {
    Remove-Item -Path $lockPath -Force -ErrorAction SilentlyContinue
}
$lockPath2 = "$env:LOCALAPPDATA\com.ailivetranslator.app\EBWebView\LOCK"
if (Test-Path $lockPath2) {
    Remove-Item -Path $lockPath2 -Force -ErrorAction SilentlyContinue
}
