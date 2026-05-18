:: Crewpilot hook wrapper for Windows
:: Routes hook invocation to the matching script via Git Bash or WSL.
@echo off
setlocal enabledelayedexpansion

set "HOOK_EVENT=%1"
if "%HOOK_EVENT%"=="" exit /b 0

set "HOOK_DIR=%~dp0"
set "HOOK_SCRIPT=%HOOK_DIR%%HOOK_EVENT%"

for %%p in (
  "%ProgramFiles%\Git\bin\bash.exe"
  "%ProgramFiles(x86)%\Git\bin\bash.exe"
  "%LocalAppData%\Programs\Git\bin\bash.exe"
) do (
  if exist %%p (
    %%p "%HOOK_SCRIPT%"
    exit /b %ERRORLEVEL%
  )
)

where wsl.exe >nul 2>&1
if %ERRORLEVEL% equ 0 (
  wsl bash "%HOOK_SCRIPT%"
  exit /b %ERRORLEVEL%
)

if exist "%HOOK_DIR%%HOOK_EVENT%.mjs" (
  node "%HOOK_DIR%%HOOK_EVENT%.mjs"
  exit /b %ERRORLEVEL%
)

exit /b 0
