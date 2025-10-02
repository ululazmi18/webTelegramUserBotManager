#!/data/data/com.termux/files/usr/bin/bash
# Setup Backend Node.js/Express.js di Termux

set -euo pipefail

echo "🔄 Update Termux..."
pkg update -y && pkg upgrade -y

echo "📦 Install dependencies utama..."
pkg install -y git python-pip clang make pkg-config

echo "📦 Install Node.js LTS (lebih stabil dari Node 24)..."
pkg uninstall -y nodejs || true
pkg install -y nodejs-lts

echo "🐍 Setup Python packages untuk node-gyp..."
pip install --upgrade pip setuptools wheel packaging
pip install distutils || true

echo "📦 Install nodemon global..."
npm install -g nodemon

echo "📂 Masuk ke project..."
cd ~/webTelegramUserBotManager

echo "📦 Install dependencies project..."
npm install --build-from-source

echo "🚀 Jalankan backend di port 3000..."
npm run dev:backend -- --port 3000
