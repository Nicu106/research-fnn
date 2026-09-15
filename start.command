#!/bin/bash
# Pornește prezentarea local (folosește Python-ul deja instalat pe macOS, fără dependențe).
cd "$(dirname "$0")"
PORT=5173
(sleep 1 && open "http://localhost:$PORT") &
python3 serve.py $PORT
