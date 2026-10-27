@echo off
cd /d "%~dp0"
taskkill /f /im ai-live-translator.exe 2>nul
start "" "src-tauri\target\debug\ai-live-translator.exe"
