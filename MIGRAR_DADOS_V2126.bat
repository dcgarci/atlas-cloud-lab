@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title ATLAS V2.12.7 - Migrar dados V2.12.6

echo.
echo ============================================================
echo       ATLAS V2.12.7 - MIGRACAO DE DADOS DA V2.12.6
echo ============================================================
echo.
echo Feche a V2.12.6 antes de continuar.
echo Procurando automaticamente o banco local na pasta irma...
echo.

set "FOUND="
for /d %%D in ("%~dp0..\*2_12_6*") do (
  if /I not "%%~fD"=="%~dp0" if exist "%%~fD\backend\ort_v2.db" set "FOUND=%%~fD\backend\ort_v2.db"
)

if not defined FOUND (
  echo [AVISO] Nenhuma V2.12.6 com backend\ort_v2.db foi encontrada na pasta irma.
  echo Se os dados estiverem em outra versao, use o migrador correspondente ou copie o banco manualmente com o ATLAS fechado.
  exit /b 2
)

echo [OK] Banco V2.12.6 encontrado:
echo !FOUND!

if exist "backend\ort_v2.db" (
  copy /y "backend\ort_v2.db" "backend\ort_v2.db.pre_v2127.bak" >nul
  if errorlevel 1 (
    echo [ERRO] Nao foi possivel criar o backup do banco atual.
    exit /b 1
  )
  echo [OK] Backup atual: backend\ort_v2.db.pre_v2127.bak
)

copy /y "!FOUND!" "backend\ort_v2.db" >nul
if errorlevel 1 (
  echo [ERRO] Nao foi possivel copiar o banco. Confirme que a V2.12.6 esta fechada.
  exit /b 1
)

echo [OK] Conta, Cofre Historico e Diario migrados para V2.12.7.
exit /b 0
