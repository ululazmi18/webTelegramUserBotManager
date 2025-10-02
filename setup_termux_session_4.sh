#!/data/data/com.termux/files/usr/bin/bash
# Setup Frontend React/Next.js di Termux

# Update & install tools
pkg update -y && pkg upgrade -y
pkg install -y nodejs git python-pip clang make build-essential

# Pastikan setuptools & wheel ada (untuk node-gyp)
pip install --upgrade pip setuptools wheel

cd ~/webTelegramUserBotManager

# Install dependency root
if [ ! -d "node_modules" ]; then
  npm install || true
fi

# Masuk ke frontend dan install dep
cd frontend
if [ ! -d "node_modules" ]; then
  npm install
fi

# Jalankan frontend di port 3001
PORT=3001 npm start
