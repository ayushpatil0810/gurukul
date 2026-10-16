@echo off
setlocal
if "%~1"=="" goto usage
if /I "%~1"=="up" goto up
if /I "%~1"=="down" goto down
if /I "%~1"=="migrate" goto migrate
if /I "%~1"=="seed" goto seed
if /I "%~1"=="test" goto test
goto usage

:up
docker compose up -d --wait
exit /b %ERRORLEVEL%

:down
docker compose down
exit /b %ERRORLEVEL%

:migrate
bun run db:migrate
exit /b %ERRORLEVEL%

:seed
call "%~f0" up || exit /b %ERRORLEVEL%
call "%~f0" migrate || exit /b %ERRORLEVEL%
bun run db:seed
exit /b %ERRORLEVEL%

:test
call "%~f0" up || exit /b %ERRORLEVEL%
call "%~f0" migrate || exit /b %ERRORLEVEL%
bun run test || exit /b %ERRORLEVEL%
bun run typecheck || exit /b %ERRORLEVEL%
bun run lint
exit /b %ERRORLEVEL%

:usage
echo Usage: make ^<up^|down^|migrate^|seed^|test^>
exit /b 1
