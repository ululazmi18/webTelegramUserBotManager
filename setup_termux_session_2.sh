#!/data/data/com.termux/files/usr/bin/env bash
set -euo pipefail

echo "🔄 Update & upgrade paket..."
pkg update -y && pkg upgrade -y

echo "📦 Install Python, pip, git, dan build tools..."
pkg install -y python python-pip git clang make pkg-config

echo "📦 Install Node.js (versi stabil bawaan Termux, bukan 22.x)..."
pkg install -y nodejs

# Pastikan pip up to date + paket pendukung build
echo "📦 Setup Python environment..."
pip install --upgrade pip setuptools wheel packaging
pip install distutils || true   # fallback distutils untuk node-gyp

# Masuk ke folder project
PROJECT_DIR="$HOME/webTelegramUserBotManager"
cd "$PROJECT_DIR"

# Install Python requirements kalau ada
if [ -f "requirements.txt" ]; then
  echo "🐍 Menginstall Python requirements..."
  pip install -r requirements.txt
fi

# Install Node.js dependencies kalau ada package.json
if [ -f "package.json" ]; then
  echo "📦 Menginstall dependencies Node.js (build from source jika perlu)..."
  npm install --build-from-source

  echo "🚀 Menjalankan service via npm..."
  npm run dev:python -- --port 5000
else
  echo "⚡ Tidak ada package.json → coba jalankan langsung service Python"
  if [ -f "app.py" ]; then
    python app.py --port 5000
  elif [ -f "main.py" ]; then
    python main.py --port 5000
  else
    echo "❌ Tidak ditemukan app.py/main.py dan tidak ada package.json"
    exit 1
  fi
fi
