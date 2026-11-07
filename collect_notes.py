"""Gom giải thích câu khó (notes/A1..C1.txt, dạng 'n|sentenceIdx|text') thành notes.json."""
import json, glob
sel = json.load(open('hard_sel.json'))
ids = {f'{n}|{si}' for n, v in sel.items() for si in v}
notes = {}
for f in sorted(glob.glob('notes/[ABC][12].txt')):
    for line in open(f, encoding='utf-8'):
        if line.strip():
            n, si, txt = line.rstrip('\n').split('|', 2)
            notes[f'{n}|{si}'] = txt
print('notes', len(notes), '| selected', len(ids), '| missing', sorted(ids - set(notes))[:10])
json.dump(notes, open('notes.json', 'w', encoding='utf-8'), ensure_ascii=False)
