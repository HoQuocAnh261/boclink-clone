@echo off
title BoclinkVN Online Server
color 0B
echo ========================================================
echo       KHOI DONG BOCLINKVN KET NOI ONLINE CLOUDFLARE
echo ========================================================
echo.
echo 1. Dang khoi dong may chu backend Node.js...
start /B node dist/index.js >nul 2>&1
timeout /t 2 >nul

echo 2. Dang ket noi Cloudflare Tunnel de lay link HTTPS Online...
echo.
cd /d "%~dp0"
.\cloudflared.exe tunnel --url http://localhost:3000
pause
