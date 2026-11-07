# Oxford 5000 Passages — học tiếng Anh qua đoạn văn

114 đoạn văn tiếng Anh về **đời sống và phát triển bản thân**, xếp từ **A1 đến C1**. Gộp lại, các đoạn dùng hết
**4.982 từ** của Oxford 3000 + Oxford 5000. Mỗi từ được dạy trong ngữ cảnh ở đúng một đoạn, và cấp của đoạn đó không
thấp hơn cấp của từ.

👉 **Dùng online:** `https://<username>.github.io/oxford5000-passages/` (sau khi bật GitHub Pages)
👉 **Dùng offline:** tải `index.html` rồi mở bằng trình duyệt. File tự chứa toàn bộ dữ liệu (~4,7 MB) và không cần mạng.

## Tính năng
| Chế độ | Nội dung |
|---|---|
| **Đọc & học từ** | Từ mới được tô màu theo cấp. Bấm vào từ để xem nghĩa, collocation, word family, câu ví dụ và phát âm. Có bản dịch tiếng Việt và 8–12 điểm ngữ pháp mỗi đoạn. |
| **Đọc hiểu** | 10 câu/đoạn: 5 trắc nghiệm, 4 True/False/Not Given, 1 câu hỏi mở. Có giải thích tiếng Việt và nút "Xem trong bài". |
| **Phân tích câu** | Câu được tô màu theo S / V / O / C / A, đánh dấu mệnh đề phụ, ghi thì và thể bị động. 326 câu khó có giải thích viết tay. |
| **Dịch ngược** | Dịch từng câu từ Việt sang Anh rồi so với câu gốc. |
| **Nghe chép chính tả** | Máy đọc từng câu (TTS) ở 3 tốc độ để bạn gõ lại. |
| **Luyện gõ** | Gõ lại cả đoạn văn, đo WPM và độ chính xác, có 2 kiểu Tự do / Nghiêm ngặt. Gõ xong từ mới nào thì nghĩa của từ đó hiện ra. Có thống kê: biểu đồ WPM và độ chính xác, thời gian luyện mỗi ngày, bàn phím tô màu phím hay gõ sai, từ hay gõ sai và bản đồ các đoạn đã gõ. |
| **Ôn tập (SRS)** | Ôn theo lịch lặp lại ngắt quãng 1-3-7-21-60-150 ngày, theo cả hai chiều Anh→Việt và Việt→Anh. |

Phím tắt: `←` / `→` chuyển đoạn, `/` tìm từ.

> Tiến độ học lưu trong `localStorage` của từng trình duyệt và từng địa chỉ. Bản online (github.io) và bản file
> offline có tiến độ riêng, và tiến độ không đồng bộ giữa các máy.

## Cấu trúc repo
```
index.html            Sản phẩm đã build (GitHub Pages phục vụ file này)
template.html, app.js Giao diện (CSS + JS); build.py nhúng app.js và DATA vào template
paras/*.txt           Đoạn văn: === n | LEVEL | Tiêu đề EN | Tiêu đề VI, rồi EN: / VI: / GR:
vocab/*.txt           Nghĩa, collocation, word family của từng từ
quiz/*.txt            Câu hỏi đọc hiểu (M / T / O), quiz_patch/ là các phương án nhiễu đã sửa
notes/*.txt           Giải thích viết tay cho câu khó (n|câu|nội dung)
words.json            Danh sách 4.982 từ Oxford (headword, POS, level) đã chuẩn hoá
grammar.py, patterns.py, gcat.py, gram_build.py   Phân tích ngữ pháp (spaCy)
parsed.spacy, gram.json, hard_sel.json             Kết quả phân tích đã lưu sẵn
check.py, vcheck.py, stats.py                       Gán từ cho đoạn, kiểm tra coverage
quizcheck.py          Kiểm tra quiz (5M/4T/1O, trích dẫn khớp nguyên văn), xáo đáp án -> quiz.json
build.sh              Build lại tất cả -> index.html
```

## Build lại sau khi sửa
```bash
pip install -r requirements.txt
./build.sh            # build nhanh, dùng kết quả phân tích ngữ pháp có sẵn
./build.sh --gram     # parse lại toàn bộ bằng spaCy en_core_web_trf (khi sửa câu trong paras/)
```
Cần Python 3.10+. Windows thì chạy trong Git Bash hoặc WSL.

Lưu ý khi chỉnh sửa:
- Coverage phải giữ nguyên **4982/4982** (`python3 vcheck.py`). Bỏ một từ khỏi đoạn này thì phải thêm nó vào một đoạn cùng
  cấp hoặc cấp cao hơn.
- Câu trích dẫn trong `quiz/` phải khớp nguyên văn với bài đọc. `quizcheck.py` sẽ báo lỗi nếu không khớp.
- `parse.py` tạo `words.json` từ danh sách Oxford gốc. Repo không kèm file gốc này, nhưng `words.json` đã có sẵn.

## Ghi công
- Danh sách từ: *The Oxford 3000™* và *The Oxford 5000™ by CEFR level* © Oxford University Press. Repo dùng danh sách
  này cho mục đích học tập phi thương mại và không phải sản phẩm chính thức của Oxford.
- Đoạn văn, bản dịch, giải thích và câu hỏi được viết riêng cho dự án này với sự hỗ trợ của Claude (Anthropic).
- Phân tích cú pháp: [spaCy](https://spacy.io). Biến đổi dạng từ: [LemmInflect](https://github.com/bjascob/LemmInflect).
