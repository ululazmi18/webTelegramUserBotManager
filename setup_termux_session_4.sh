#!/data/data/com.termux/files/usr/bin/bash
# Setup Frontend React/Next.js di Termux (fix Node v24 issue)

set -euo pipefail

echo "🔄 Update Termux..."
pkg update -y && pkg upgrade -y

echo "📦 Install dependencies utama..."
pkg uninstall -y nodejs || true
pkg install -y nodejs-lts git python-pip clang make build-essential

echo "🐍 Setup Python packages (untuk node-gyp)..."
pip install --upgrade pip setuptools wheel packaging

echo "📂 Masuk ke project..."
cd ~/webTelegramUserBotManager

echo "🧹 Bersihkan node_modules & reinstall..."
rm -rf node_modules package-lock.json
npm install --force

echo "📂 Masuk ke frontend..."
cd frontend
rm -rf node_modules package-lock.json
npm install --force

echo "🚀 Jalankan frontend di port 3001 (skip eslint)..."
DISABLE_ESLINT_PLUGIN=true PORT=3001 npm start
