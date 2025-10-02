#!/data/data/com.termux/files/usr/bin/env bash
set -euo pipefail

# Skrip setup Redis di Termux (minimal config, suppress ARM64 COW warning)

# Update & upgrade paket
pkg update -y && pkg upgrade -y

# Install Redis jika belum ada
pkg install -y redis

# Direktori & file config
REDIS_HOME="$HOME"
REDIS_CONF="$REDIS_HOME/redis.conf"
REDIS_LOG="$REDIS_HOME/redis.log"
REDIS_PID="$REDIS_HOME/redis.pid"

# Hentikan instance redis yang mungkin sedang berjalan
echo "Menghentikan redis-server lama (jika ada)..."
pkill -f redis-server || true
sleep 1

# Bersihkan file lama
rm -f "$REDIS_CONF" "$REDIS_LOG" "$REDIS_PID"

# Buat konfigurasi minimal yang aman untuk Termux/Android
cat > "$REDIS_CONF" <<'EOF'
# Minimal redis.conf untuk Termux/Android
port 6379
daemonize yes
protected-mode no
save ""              # non-aktifkan RDB snapshot
appendonly no        # non-aktifkan AOF
dir /data/data/com.termux/files/home
logfile /data/data/com.termux/files/home/redis.log
pidfile /data/data/com.termux/files/home/redis.pid

# Suppress known ARM64 COW kernel warning (gunakan jika kamu memahami risikonya)
ignore-warnings ARM64-COW-BUG
EOF

# Pastikan file terbuat dan bisa dibaca Redis
chmod 600 "$REDIS_CONF" || true

# Jalankan redis-server dengan config yang sudah dibuat
echo "Menjalankan redis-server dengan konfigurasi: $REDIS_CONF"
redis-server "$REDIS_CONF"

echo "Redis-server seharusnya sudah berjalan (cek $REDIS_LOG atau 'pgrep -a redis-server')."
