cat > "$REDIS_CONF" <<'EOF'
# Minimal redis.conf untuk Termux/Android
port 6379
daemonize yes
protected-mode no

# Non-aktifkan RDB snapshot
save ""

# Non-aktifkan AOF
appendonly no

dir /data/data/com.termux/files/home
logfile /data/data/com.termux/files/home/redis.log
pidfile /data/data/com.termux/files/home/redis.pid

# Suppress known ARM64 COW kernel warning (gunakan jika kamu memahami risikonya)
ignore-warnings ARM64-COW-BUG
EOF
