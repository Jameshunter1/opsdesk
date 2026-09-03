@echo off
rem OpsDesk sync server — double-click to run. Close the window to stop.
cd /d "%~dp0"
title OpsDesk sync server
echo.
echo  Starting the OpsDesk sync server (this window must stay open).
echo  Your accounts database is opsdesk.db in this folder — back it up.
echo.
node server.js
echo.
echo  Server stopped.
pause
