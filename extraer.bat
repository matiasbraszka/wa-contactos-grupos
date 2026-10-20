@echo off
cd /d "%~dp0"
set NODE_OPTIONS=--use-system-ca
node extraer.mjs
pause
