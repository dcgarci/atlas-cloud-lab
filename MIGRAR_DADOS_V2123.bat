@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title ATLAS V2.12.6 - Migrar dados V2.12.3

echo.
echo ============================================================
echo       ATLAS V2.12.6 - MIGRACAO DE DADOS DA V2.12.3
echo ============================================================
echo.
echo Este processo procura uma V2.12.3 na pasta irma e copia somente
echo o banco local: conta, Cofre Historico, Paper/diario e configuracoes
echo persistidas no banco. Feche o ATLAS antes de continuar.
echo.

set "FOUND="
for /d %%D in ("%~dp0..\*2_12_3*") do (
  if exist "%%~fD\backend\ort_v2.db" set "FOUND=%%~fD\backend\ort_v2.db"
)

if not defined FOUND (
  echo [AVISO] Nenhuma V2.12.3 com backend\ort_v2.db foi encontrada ao lado desta pasta.
  echo Copie manualmente o arquivo backend\ort_v2.db da versao anterior se quiser manter os dados.
  exit /b 2
)

echo [OK] Banco anterior encontrado:
echo !FOUND!

if exist "backend\ort_v2.db" (
  copy /y "backend\ort_v2.db" "backend\ort_v2.db.pre_v2126.bak" >nul
  echo [OK] Backup do banco atual criado: backend\ort_v2.db.pre_v2126.bak
)

copy /y "!FOUND!" "backend\ort_v2.db" >nul
if errorlevel 1 (
  echo [ERRO] Nao foi possivel copiar o banco. Confirme que todas as versoes do ATLAS estao fechadas.
  exit /b 1
)

echo [OK] Dados da V2.12.3 migrados para V2.12.6.
echo.
exit /b 0
