@echo off
cd /d "%~dp0"
taskkill /f /im ai-live-translator.exe 2>nul
del /f /q "%LOCALAPPDATA%\com.ailivetranslator.app\EBWebView\Default\LOCK" 2>nul
start "" "src-tauri\target\debug\ai-live-translator.exe"
