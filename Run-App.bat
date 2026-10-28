@echo off
cd /d "C:\Users\kai.ngo\Downloads\Kai_ngo\ai-live-translator"
taskkill /f /im ai-live-translator.exe 2>nul
del /f /q "%LOCALAPPDATA%\com.ailivetranslator.app\EBWebView\Default\LOCK" 2>nul
del /f /q "%LOCALAPPDATA%\com.ailivetranslator.app\EBWebView\LOCK" 2>nul
echo App launched at %date% %time% >> "C:\Users\kai.ngo\Downloads\Kai_ngo\ai-live-translator\run_app.log"
start "" "C:\Users\kai.ngo\Downloads\Kai_ngo\ai-live-translator\src-tauri\target\debug\ai-live-translator.exe"
