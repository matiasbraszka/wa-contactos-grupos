@echo off
cd /d "%~dp0"
set NODE_OPTIONS=--use-system-ca
set MAS_NOMBRES=1
node extraer.mjs
pause
