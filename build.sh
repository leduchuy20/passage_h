#!/usr/bin/env bash
# Build lại index.html từ source.
#   ./build.sh          build nhanh (dùng gram.json, parsed.spacy có sẵn)
#   ./build.sh --gram   chạy lại cả phân tích cú pháp (cần spaCy en_core_web_trf, ~2 phút)
set -e
cd "$(dirname "$0")"
mkdir -p out
python3 vcheck.py >/dev/null || true
python3 build.py                 # lần 1: tạo DATA (câu, từ vựng) để các bước sau đọc
if [ "$1" == "--gram" ]; then
  python3 parse_all.py           # spaCy -> parsed.spacy
  python3 gram_build.py          # -> gram.json
  python3 select_hard.py         # -> hard_sel.json (+ notes/todo_*.txt để viết giải thích)
fi
python3 collect_notes.py         # notes/*.txt -> notes.json
python3 quizcheck.py             # quiz/*.txt -> quiz.json (kiểm tra trích dẫn)
python3 build.py                 # lần 2: build bản đầy đủ
cp out/oxford5000_doan_van.html index.html
echo "OK -> index.html"
