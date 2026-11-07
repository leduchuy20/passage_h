import json, re, time, spacy
from spacy.tokens import DocBin
h = open('out/oxford5000_doan_van.html', encoding='utf-8').read()
i = h.find('const DATA = ') + 13; j = h.find(';\nconst P = DATA')
d = json.loads(h[i:j])
import re
sents = []; offs = []
for p in d['paras']:
    for k, s in enumerate(p['ss']):
        t = s[0]; off = 0
        m = re.match(r'^(Reporter|Mr Hai):\s+', t) if p['n'] == 56 else None
        if m:
            off = m.end(); t = t[off:]
        sents.append((p['n'], k, t)); offs.append(off)
nlp = spacy.load('en_core_web_trf')
t = time.time()
db = DocBin(store_user_data=False)
for doc in nlp.pipe([s for _, _, s in sents], batch_size=32):
    db.add(doc)
db.to_disk('parsed.spacy')
json.dump([[n, k, o] for (n, k, _), o in zip(sents, offs)], open('parsed_index.json', 'w'))
print(len(sents), 'sentences', round(time.time() - t), 's')
