# CLAUDE.md — Oxford 5000 Passages (học tiếng Anh qua đoạn văn)

## Mục đích
Bộ đoạn văn tiếng Anh về **đời sống và phát triển bản thân** để học từ vựng qua ngữ cảnh.
Cả bộ phủ **toàn bộ 4.982 từ Oxford 5000** (Oxford 3000 + 5000, theo CEFR) và sắp xếp
**tăng dần A1 → C1**. Người dùng (led_huy) học bằng cách đọc và viết đoạn văn.

## Quy ước giao tiếp
- Trả lời bằng **tiếng Việt**, giữ nguyên các thuật ngữ kỹ thuật bằng tiếng Anh.
- UI của file HTML viết bằng tiếng Việt; nội dung đoạn văn viết bằng tiếng Anh, có bản dịch tiếng Việt.
- Nếu yêu cầu chưa rõ thì hỏi trước khi làm những thay đổi lớn (ví dụ viết lại nhiều đoạn).

## File trong repo
- `index.html` — sản phẩm đã build, **một file self-contained** (~4,7 MB), chạy offline, được GitHub Pages phục vụ.
  Data được nhúng sẵn trong `const DATA = {...}` ở thẻ `<script>`. **Không sửa tay**: sửa source rồi chạy `./build.sh`.
- `template.html` (CSS + khung HTML, thẻ `<script>` chỉ chứa placeholder `/*__APP__*/`) và `app.js` (toàn bộ JS UI).
  `build.py` thay `/*__APP__*/` bằng `app.js`, thay `/*__DATA__*/null` bằng DATA, rồi ghi
  `out/oxford5000_doan_van.html`; `build.sh` copy file đó ra `index.html`.
- `paras/*.txt` (đoạn văn), `vocab/*.txt` (từ điển), `quiz/*.txt` + `quiz_patch/*.txt` (đọc hiểu),
  `notes/*.txt` (giải thích câu khó), `words.json` (danh sách Oxford đã chuẩn hoá).
- Pipeline ngữ pháp: `parse_all.py` → `parsed.spacy`/`parsed_index.json`; `grammar.py` + `patterns.py` + `gcat.py`,
  `gram_build.py` → `gram.json`; `select_hard.py` → `hard_sel.json`; `collect_notes.py` → `notes.json`.
- `quizcheck.py` → `quiz.json`; `applypatch.py` áp phương án nhiễu từ `quiz_patch/`.
- `README.md` (giới thiệu repo), `CLAUDE.md` (file này).

## Nội dung hiện có
| Cấp | Số đoạn | Đoạn số | Độ dài (từ) | Từ mới/đoạn (TB) |
|-----|--------:|---------|-------------|-----------------:|
| A1  | 16 | 1–16    | 285–307 | ~50 |
| A2  | 21 | 17–37   | 284–316 | ~33 |
| B1  | 28 | 38–65   | 291–340 | ~30 |
| B2  | 28 | 66–93   | 312–571 | ~48 |
| C1  | 21 | 94–114  | 485–650 | ~61 |

Tổng cộng **114 đoạn**. Ban đầu người dùng yêu cầu ~90 đoạn × ~300 từ, nhưng như vậy không đủ chỗ để
dùng hết 5000 từ một cách tự nhiên, nên số đoạn được tăng lên và các đoạn B2/C1 dài hơn.

Mỗi đoạn có: đoạn văn EN (từ mới được tô màu theo cấp độ), bản dịch VI, danh sách từ vựng,
8–12 điểm ngữ pháp (A1: 8, A2: 9, B1: 10, B2: 11, C1: 12), phân tích cấu trúc của từng câu,
và 10 câu đọc hiểu (5 trắc nghiệm, 4 True/False/Not Given, 1 câu hỏi mở).

## Cách giải thích từ vựng (phân tầng theo cấp độ)
- **A1–A2:** chỉ nghĩa tiếng Việt ngắn gọn.
- **B1–C1:** nghĩa + **collocation** + **word family** + câu ví dụ (lấy từ chính câu trong đoạn, từ đó được in đậm).
- Mỗi từ chỉ được "dạy" ở **một** đoạn (lần xuất hiện đầu tiên được gán), và đoạn đó phải có cấp ≥ cấp của từ.
- Từ đa nghĩa hoặc trùng chữ được phân biệt bằng alias, ví dụ: `bank:money` / `bank:river`, `light:lamp` / `light:weight`,
  `can1` / `can2`, `lie1` / `lie2`, `IT` / `it`, `May` / `may`.

## Cấu trúc data trong HTML
```js
DATA = {
  paras: [{ n, lv, t /*title EN*/, tv /*title VI*/, en /*HTML có <span class="w B1" data-a="alias">*/,
            vi /*HTML*/, wc /*word count*/, gr: [[pattern, giải thích], ...],
            w: [{ a /*alias*/, ex /*câu ví dụ, có <b>*/, form /*dạng xuất hiện trong bài*/ }],
            ss: [[en_sentence, vi_sentence, [alias...]], ...] /*câu EN↔VI đã căn 1:1, dùng cho Dịch ngược & Nghe chép*/
            g: [{ t /*loại câu: simple|compound|complex|cc|frag*/, r: [[start,end,role,clauseIdx]] /*role: S,Sg,V,O,C,A,K,I,L*/,
                  c: [[type, extra, advCat, tense, passive, finite, parentIdx, roleInParent, [[role,text]], hasSubj, start, end]],
                  k: [[grammarKey, start, end]] /*các cấu trúc tìm thấy trong câu*/, n /*giải thích viết tay cho câu khó (nếu có)*/ }],
            gp: [{ k /*grammarKey*/ | h: [pattern, giải thích] /*điểm viết tay*/, o: [[sentenceIdx, start, end]] }],
            qz: [ {t:'M', q, o:[4 lựa chọn], a /*index đúng*/, e /*giải thích VI*/, r:[[sentenceIdx,start,end],...] /*câu trích dẫn*/}
                | {t:'T', q, a /*0=True 1=False 2=Not Given*/, e, r /*null nếu NG*/}
                | {t:'O', q, h /*gợi ý VI*/, w:[min,max] /*số từ*/} ] /*10 câu: 5 M, 4 T, 1 O*/ }],
  gcat: { [grammarKey]: [tên, công thức, giải thích, cấp độ] },
  dict:  { [alias]: { w /*headword*/, s /*sense*/, p /*POS*/, l /*level*/,
                      m /*nghĩa VI*/, c /*collocation*/, f /*word family*/, src /*"3000"|"5000"*/ } }
}
```
- Tiến độ học ("Đã thuộc") lưu trong `localStorage` với prefix `ox5k_` (bọc try/catch). Dữ liệu này chỉ nằm
  trong trình duyệt đang dùng, không đồng bộ giữa các máy.
- Phát âm dùng Web Speech API (`speechSynthesis`), nên chất lượng giọng phụ thuộc vào máy.
- Tính năng: sidebar theo cấp độ, tìm từ (`/`), chuyển đoạn bằng ←/→, popover khi bấm từ, chế độ
  "Tự kiểm tra" (ẩn nghĩa), "Tô màu từ mới", "Bản dịch tiếng Việt", dark mode, responsive cho mobile.
- Trong text HTML, mỗi câu được bọc bằng `<span class="sn" data-s="k">`, với textContent trùng `ss[k][0]`, nên offset
  ký tự trong `g`/`gp` dùng chung được cho cả chế độ đọc lẫn tab phân tích câu.
- Mỗi đoạn có 6 chế độ (tab `.modes`, lưu ở `opts.mode`):
  - **Đọc & học từ**: chế độ đọc gốc. Cuối trang là phần "Ngữ pháp trong đoạn": bấm vào một điểm thì `markRange()`
    bọc các đoạn tương ứng trong `#text` bằng `<mark class="gm">`.
  - **Đọc hiểu** (`rc`): bài đọc (có nút ẩn để làm "closed-book") + Phần 1 trắc nghiệm, Phần 2 True/False/Not Given,
    nút Nộp bài → điểm x/9, đáp án, giải thích tiếng Việt, câu trích dẫn và nút "Xem trong bài" tô sáng câu đó trong bài
    đọc. Phần 3 là câu hỏi mở: textarea đếm số từ + nút "Sao chép để nhờ Claude chữa". Lưu ở `ox5k_rc_<n>` =
    `{ans:{i:choice}, sub, best, open}`; điểm cao nhất hiện trên dòng meta của đoạn.
  - **Phân tích câu** (`gram`): mỗi câu được tô màu theo vai trò (S xanh dương, V đỏ, O xanh lá, C tím, A cam, K xám),
    mệnh đề phụ đặt trong `[ₙ … ]`, có nhãn loại câu và thì. Nút "Chi tiết" mở bảng mệnh đề (MĐ1, MĐ2…, kiểu mệnh đề,
    thì, các thành phần). Câu khó có khung 💡 viết tay. Các chip điểm ngữ pháp ở đầu tab dùng để tô sáng câu, làm mờ
    những câu không chứa điểm đó. Có các tùy chọn `opts.gVi` / `gAll` / `gHard`.
  - **Dịch ngược**: hiện từng câu VI, người học gõ bản EN, so sánh LCS theo từ với câu gốc (tô vàng phần khác),
    chip "Từ vựng nên dùng" sáng lên khi đã dùng từ đó; phần tổng kết có nút "Sao chép để nhờ Claude sửa"
    (tạo prompt gồm câu VI, bản dịch của người học và bản gốc). Lưu ở `ox5k_bt_<n>` = `{k, a:{i:text}, sc:{i:score}}`.
  - **Nghe chép chính tả**: TTS đọc từng câu (3 tốc độ 0.92/0.75/0.6), nhấn riêng phím Ctrl để nghe lại, Enter để
    kiểm tra hoặc sang câu sau, nút "Gợi ý 1 từ" và "Hiện đáp án"; từ còn thiếu được che bằng `_`.
    Lưu ở `ox5k_dc_<n>`.
  - **Luyện gõ** (`type`): gõ lại cả đoạn liền mạch (chuỗi gõ = các câu `ss` nối bằng 1 dấu cách). Mỗi ký tự là một
    `<span class="tc">`; input lấy từ một textarea ẩn qua `beforeinput` (`insertText`, `deleteContentBackward`,
    `deleteWordBackward`). Có 2 kiểu (`opts.tyStrict`): **Tự do** (gõ sai vẫn đi tiếp, tô đỏ, Backspace/Ctrl+Backspace để
    sửa) và **Nghiêm ngặt** (phải gõ đúng mới đi tiếp). `TY_ALT` cho phép gõ `-` thay `—`, `e` thay `é`, `'` thay `’`.
    Ký tự non-ASCII không mong đợi thì hiện cảnh báo tắt Unikey/EVKey. WPM = (ký tự đúng / 5) / phút; độ chính xác =
    phím đúng / tổng phím; khoảng nghỉ giữa hai phím tối đa tính 5 giây. Khung gõ cao 5 dòng (mobile 6), luôn giữ dòng
    đang gõ ở vị trí dòng thứ 2. Gõ xong một từ mục tiêu (vị trí lấy từ span `.w` trong `en`, hàm `tyWords`) thì thẻ
    nghĩa hiện bên dưới (`opts.tyMean`); `opts.tyHl` gạch chân từ mới theo màu cấp độ. Tiến độ lượt đang gõ lưu ở
    `ox5k_ty_<n>` = `{best:{w,a,d}, runs, cur:{t,ms,k,e,m,x}}` (`m` = index ký tự từng gõ sai, `x` = số lần sai theo
    ký tự); mỗi lượt hoàn thành được ghi vào `ox5k_tyhist` (tối đa 500 mục `{d,n,w,a,ms,s,x}`), là dữ liệu cho giai đoạn 2.
    Kỷ lục WPM hiện trên dòng meta của đoạn.
- **Ôn tập theo lịch (SRS)**: nút "Ôn tập" trên top bar hiện số từ đến hạn. Bấm "Đánh dấu thuộc" sẽ đưa từ vào lịch
  `ox5k_srs` = `{alias: {i: bậc, d: ngày đến hạn (số ngày local), r: số lần ôn, l: số lần quên}}`, đến hạn ngày hôm sau.
  Khoảng cách các bậc `INT = [1,3,7,21,60,150]` ngày. Quên → về bậc 0 (ôn lại sau 1 ngày) và hỏi lại trong lượt;
  Nhớ → lên 1 bậc; Dễ → lên 2 bậc. Có hai chiều ôn: Anh → Việt (lật thẻ) và Việt → Anh (gõ từ; headword trong nghĩa
  được che bằng `maskWord`). "Ôn tự do" không đổi lịch. Bỏ đánh dấu thuộc sẽ xoá từ khỏi lịch. Số lượt ôn mỗi ngày
  lưu ở `ox5k_revlog` (giữ 90 ngày).

## Phân tích ngữ pháp được tạo thế nào
- Từng câu được phân tích cú pháp bằng spaCy `en_core_web_trf` (dependency parse). Từ đó rút ra các mệnh đề (mỗi động từ
  đầu mệnh đề là một MĐ), vai trò S/V/O/C/A, thì (kể cả semi-modal have to / going to / used to), thể bị động và khoảng
  90 loại cấu trúc ngữ pháp (`gcat`): mệnh đề quan hệ, câu điều kiện 0/1/2/3/hỗn hợp, phân từ, đảo ngữ, câu chẻ, so sánh, v.v.
- Đã có hậu xử lý cho các lỗi parser hay gặp: dấu chấm phẩy, dấu hai chấm hoặc dấu phẩy nối hai mệnh đề độc lập; nhãn người
  nói trong hội thoại ("Reporter:"); động từ có dạng quá khứ và hiện tại giống nhau (put, cut, set…) được xác định thì
  theo thì chiếm đa số trong đoạn.
- Mỗi đoạn có 8–12 điểm ngữ pháp, gồm các điểm viết tay gốc (`gr`) và các điểm tự động, xếp hạng theo trọng số, mức
  độ phù hợp với cấp độ và số lần xuất hiện. Điểm tự động trùng với điểm viết tay thì bị bỏ hoặc gộp lại.
- 326 câu khó (A1: 2, A2: 2, B1: 3, B2: 3, C1: 4 câu mỗi đoạn) có giải thích tiếng Việt viết tay (`g[k].n`).
- Phần tự động có thể sai ở một số câu, và UI có ghi chú điều này. Nếu người dùng báo một câu bị phân tích sai, nên sửa
  thẳng `g[k]` trong DATA hoặc thêm/sửa giải thích viết tay `n` cho câu đó.

## Bài đọc hiểu được tạo thế nào
- Câu hỏi được viết tay cho từng đoạn, dựa trên nội dung bài; mỗi câu trắc nghiệm và mỗi câu True/False có một câu trích
  dẫn khớp nguyên văn với bài. Not Given không có trích dẫn.
- Thứ tự A/B/C/D được xáo cố định (seed theo số đoạn và số câu) để đáp án chia đều.
- Các phương án nhiễu đã được viết lại để đáp án đúng không còn "luôn dài nhất" (giảm từ ~85% xuống ~36% số câu).
  Khi thêm câu mới, tránh để đáp án đúng dài và chi tiết hơn hẳn các phương án còn lại.
- Câu hỏi mở dùng mẫu: câu hỏi tiếng Anh, gợi ý tiếng Việt (cấu trúc nên dùng), độ dài mục tiêu tăng theo cấp độ
  (A1 60–90 → C1 130–180 từ).

## Khi chỉnh sửa
- Mọi thay đổi đều sửa ở source (`paras/`, `vocab/`, `quiz/`, `notes/`, `app.js`, `template.html`) rồi chạy
  `./build.sh`. Nếu sửa câu chữ trong `paras/` thì chạy `./build.sh --gram`, vì offset ký tự của phân tích câu phụ thuộc
  vào text (cần spaCy `en_core_web_trf`).
- Thêm hoặc viết lại đoạn văn: phải giữ nguyên **coverage 4.982/4.982**. Từ nào bị xóa khỏi một đoạn thì
  phải được đưa vào một đoạn khác cùng cấp hoặc cấp cao hơn. Sau đó cập nhật `w` của đoạn và `en`/`vi` cho khớp.
- Các đoạn văn mới cần: chủ đề đời sống / phát triển bản thân, văn phong tự nhiên, có bản dịch VI,
  có 2–4 điểm ngữ pháp viết tay dạng `pattern :: giải thích` (nên có ví dụ trích trong ngoặc kép để định vị trong bài).
  Đoạn mới cũng cần chạy lại phần phân tích câu, hoặc ít nhất phải có `g`, `gp` hợp lệ (mảng rỗng thì UI tự quay về dạng cũ).
- Repo không kèm các file text gốc trích từ PDF Oxford (dùng cho `parse.py`), vì lý do bản quyền. `words.json` đã đủ để build.

## Nguồn
- *The Oxford 3000 by CEFR level* và *The Oxford 5000 by CEFR level* (PDF của Oxford University Press).
  Những từ xuất hiện ở nhiều cấp được gộp về cấp thấp nhất (A1 900, A2 800, B1 700, B2 1.298, C1 1.284).
