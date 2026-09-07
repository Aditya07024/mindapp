#!/bin/bash
# SSH VPS Deployment Automation Script for Backend
set -e

echo "=========================================="
echo " Starting Backend Deployment on SSH Server"
echo "=========================================="

echo "[1/4] Pulling latest code from git..."
git pull origin main

echo "[2/4] Installing dependencies..."
npm install --production=false

echo "[3/4] Building TypeScript code..."
npm run build

echo "[4/4] Restarting PM2 Process..."
if command -v pm2 &> /dev/null; then
  pm2 reload ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production
  pm2 save
  echo "=========================================="
  echo " SUCCESS: Backend deployed and active!"
  echo "=========================================="
else
  echo "WARNING: PM2 is not installed globally."
  echo "Run: npm install -g pm2"
  echo "Then start with: pm2 start ecosystem.config.js --env production"
fi
