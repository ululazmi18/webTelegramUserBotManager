#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

PROJECT_DIR="$HOME/webTelegramUserBotManager"
PY_SERVICE="$PROJECT_DIR/python-service"
VENV_DIR="$PY_SERVICE/venv"

echo "🐍 Setup Python virtualenv..."
cd "$PY_SERVICE"
if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv venv
fi

# Aktifkan venv
source "$VENV_DIR/bin/activate"

echo "📦 Install Python dependencies..."
pip install --upgrade pip setuptools wheel
if [ -f "requirements.txt" ]; then
  pip install -r requirements.txt
fi

echo "🚀 Menjalankan Python FastAPI service di port 5000..."
exec uvicorn app:app --host 0.0.0.0 --port 5000
