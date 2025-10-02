#!/bin/bash

# Script sederhana untuk add, commit, dan push ke branch main

# Cek apakah ada argumen untuk pesan commit
if [ -z "$1" ]
then
  echo "⚠️  Harap masukkan pesan commit."
  echo "👉 Contoh: ./gitpush.sh \"update fitur login\""
  exit 1
fi

# 1. Tambahkan semua perubahan
git add .

# 2. Commit dengan pesan yang diberikan
git commit -m "$1"

# 3. Push ke remote main (dengan upstream untuk pertama kali)
git push -u origin main
