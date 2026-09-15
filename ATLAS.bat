@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title ATLAS V2.12.21 LAB

rem Launcher unico para uso diario. Na primeira execucao prepara automaticamente.
if not exist ".venv\Scripts\python.exe" goto :prepare
if not exist "frontend\dist\index.html" goto :prepare
if not exist "frontend\dist\atlas-build-version.txt" goto :prepare
findstr /x /c:"2.12.21" "frontend\dist\atlas-build-version.txt" >nul 2>nul
if errorlevel 1 goto :prepare
goto :start

:prepare
echo [ATLAS] Primeira execucao neste computador. Preparando ambiente...
call "%~dp0PREPARAR_ATLAS.bat"
if errorlevel 1 (
  echo [ERRO] Preparacao nao concluida.
  pause
  exit /b 1
)

:start
call "%~dp0scripts\ATLAS_INICIAR.bat"
exit /b %errorlevel%
