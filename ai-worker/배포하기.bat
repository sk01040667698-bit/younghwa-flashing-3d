@echo off
chcp 65001 >nul
title YOUNGHWA - Pansooni AI Worker deployment
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is required. Install Node.js LTS from https://nodejs.org/
  echo Then run this file again.
  pause
  exit /b 1
)
echo.
echo Step 1. Sign into your own Cloudflare account via browser.
call npx --yes wrangler login
if errorlevel 1 (
 echo [ERROR] Cloudflare authentication was not completed.
 pause
 exit /b 1
)
echo.
echo Step 2. Deploy the free Workers AI backend.
call npx --yes wrangler deploy
if errorlevel 1 (
 echo [ERROR] Deployment failed. Check the output above.
 pause
 exit /b 1
)
echo.
echo [DONE] Copy only the public https://...workers.dev URL shown above.
echo NEVER share Cloudflare API tokens or passwords in chat.
pause
