@echo off
cd /d "%~dp0"
if exist "src-tauri\target\debug\ai-live-translator.exe" (
    start "" "src-tauri\target\debug\ai-live-translator.exe"
) else (
    start "" "src-tauri\target\release\ai-live-translator.exe"
)
