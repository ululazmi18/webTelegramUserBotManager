#!/data/data/com.termux/files/usr/bin/env bash
set -euo pipefail

echo "🔄 Update & upgrade paket..."
pkg update -y && pkg upgrade -y

echo "📦 Install Python, pip, git, dan build tools..."
pkg install -y python python-pip git clang make pkg-config

echo "📦 Install Node.js (versi stabil bawaan Termux)..."
pkg install -y nodejs

# Pastikan pip up to date
echo "🐍 Setup Python environment..."
pip install --upgrade pip setuptools wheel packaging

# Masuk ke folder project
PROJECT_DIR="$HOME/webTelegramUserBotManager"
cd "$PROJECT_DIR"

# Install Python requirements kalau ada
if [ -f "requirements.txt" ]; then
  echo "🐍 Menginstall Python requirements..."
  pip install -r requirements.txt || true
fi

# Install Node.js dependencies
if [ -f "package.json" ]; then
  echo "📦 Menginstall dependencies Node.js dengan opsi aman untuk Termux..."
  npm install --unsafe-perm --legacy-peer-deps || true

  echo "🚀 Menjalankan service via npm..."
  if npm run | grep -q "dev:python"; then
    npm run dev:python -- --port 5000
  else
    npm start || node app.js || python app.py --port 5000
  fi
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
