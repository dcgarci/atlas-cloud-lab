@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title ATLAS - Atualizador por Patch
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\_internal\apply_patch.ps1" %*
if errorlevel 1 (
  echo.
  echo [ERRO] Patch nao aplicado. A instalacao atual foi preservada.
  pause
  exit /b 1
)
echo.
echo [OK] Atualizacao concluida.
pause
exit /b 0
