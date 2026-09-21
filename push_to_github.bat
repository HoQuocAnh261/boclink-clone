@echo off
title Day code len GitHub
color 0B
echo ========================================================
echo         DAY SOURCE CODE BOCLINK-CLONE LEN GITHUB
echo ========================================================
echo.
echo 1. Tao mot Repository moi tren GitHub: https://github.com/new
echo 2. Copy link repository (Vi du: https://github.com/username/boclink-clone.git)
echo.
set /p REPO_URL="Dan link GitHub Repository cua ban vao day: "

if "%REPO_URL%"=="" (
    echo [!] Ban chua nhap link GitHub. Huy bo.
    pause
    exit /b
)

cd /d "%~dp0"
git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%
git branch -M main
echo.
echo Dang day code len GitHub...
git push -u origin main

echo.
echo ========================================================
echo [OK] Hoan tat! Bay gio ban co the vao https://dashboard.render.com
echo va chon Web Service ket noi voi Repository nay de Deploy 24/7 mien phi.
echo ========================================================
pause
