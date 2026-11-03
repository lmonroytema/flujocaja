@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0generar-paquete.ps1" %*
pause
