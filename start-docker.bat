@echo off
REM Start Docker Desktop
echo Starting Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

REM Wait for Docker to be ready
echo Waiting for Docker daemon to start (30 seconds)...
timeout /t 30 /nobreak

REM Check Docker status
echo Checking Docker status...
docker ps

REM Build and start Vaultex services
echo Building and starting Vaultex...
docker compose up --build
