#!/data/data/com.termux/files/usr/bin/bash
# Setup Backend Node.js/Express.js di Termux (fix build error)

set -euo pipefail

echo "🔄 Update Termux..."
pkg update -y && pkg upgrade -y

echo "📦 Install dependencies utama..."
pkg install -y git python-pip clang make pkg-config

echo "📦 Install Node.js LTS..."
pkg uninstall -y nodejs || true
pkg install -y nodejs-lts

echo "🐍 Setup Python packages untuk node-gyp..."
pip install --upgrade setuptools wheel packaging || true

echo "📦 Install nodemon global..."
npm install -g nodemon || true

echo "📂 Masuk ke project..."
cd ~/webTelegramUserBotManager

echo "⚙️ Set environment supaya skip build native..."
export npm_config_build_from_source=false
export npm_config_force_process_config=true

echo "📦 Install dependencies project (skip error build)..."
npm install --unsafe-perm --legacy-peer-deps || true

echo "🚀 Jalankan backend di port 3000..."
npm run dev:backend -- --port 3000 || true
