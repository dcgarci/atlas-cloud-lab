@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title ATLAS V2.12.6 - Migrar dados V2.12.5

echo.
echo ============================================================
echo       ATLAS V2.12.6 - MIGRACAO DE DADOS DA V2.12.5
echo ============================================================
echo.
echo Procurando automaticamente o banco local da V2.12.5...
echo Feche a versao antiga do ATLAS antes de executar esta migracao.
echo.

set "FOUND="
for /d %%D in ("%~dp0..\*2_12_5*") do (
  if exist "%%~fD\backend\ort_v2.db" set "FOUND=%%~fD\backend\ort_v2.db"
)

if not defined FOUND (
  echo [AVISO] Nenhuma V2.12.5 com backend\ort_v2.db foi encontrada na pasta irma.
  echo Se seus dados ainda estiverem na V2.12.3, use MIGRAR_DADOS_V2123.bat.
  exit /b 2
)

echo [OK] Banco V2.12.5 encontrado:
echo !FOUND!

if exist "backend\ort_v2.db" (
  copy /y "backend\ort_v2.db" "backend\ort_v2.db.pre_v2126.bak" >nul
  echo [OK] Backup do banco atual criado: backend\ort_v2.db.pre_v2126.bak
)

copy /y "!FOUND!" "backend\ort_v2.db" >nul
if errorlevel 1 (
  echo [ERRO] Nao foi possivel copiar o banco. Confirme que o ATLAS antigo esta fechado.
  exit /b 1
)

echo [OK] Conta, Cofre Historico e diario migrados para V2.12.6.
exit /b 0
