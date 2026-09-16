#!/bin/bash
# Start Docker Desktop and Vaultex services

echo "Starting Docker Desktop..."
open --background -a Docker

echo "Waiting for Docker daemon to start (15 seconds)..."
sleep 15

echo "Checking Docker status..."
docker ps

echo "Building and starting Vaultex..."
docker compose up --build
