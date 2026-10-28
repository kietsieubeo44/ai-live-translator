@echo off
cd /d "C:\Users\kai.ngo\Downloads\Kai_ngo\ai-live-translator"
powershell.exe -ExecutionPolicy Bypass -File "C:\Users\kai.ngo\Downloads\Kai_ngo\ai-live-translator\kill_app.ps1" 2>nul
timeout /t 1 /nobreak >nul
del /f /q "%LOCALAPPDATA%\com.ailivetranslator.app\EBWebView\Default\LOCK" 2>nul
del /f /q "%LOCALAPPDATA%\com.ailivetranslator.app\EBWebView\LOCK" 2>nul
start "" "C:\Users\kai.ngo\Downloads\Kai_ngo\ai-live-translator\src-tauri\target\debug\ai-live-translator.exe"
echo App launched at %date% %time% >> "C:\Users\kai.ngo\Downloads\Kai_ngo\ai-live-translator\run_app.log"
