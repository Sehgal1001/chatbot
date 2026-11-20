@echo off
title Chatbot - Local Server
cd /d "%~dp0"
echo ==========================================
echo                 CHATBOT
echo ==========================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install it from https://nodejs.org/
  pause
  exit /b 1
)
echo Starting Chatbot with Vercel local runtime...
echo Keep this window open while using Chatbot.
echo When the server starts, open http://localhost:3000
echo.
call npx vercel dev
echo.
echo Chatbot server stopped.
pause
