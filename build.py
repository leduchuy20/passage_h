import json, re, glob, html
import check

W = check.W
BY = check.BYALIAS
paras = check.parse_files()
assign, missing, errors = check.analyze(paras, verbose=False)
assert not errors, errors
assert sum(len(v) for v in missing.values()) == 0, missing

# ---- vocab definitions (merge duplicates across files, A1 first) ----
V = {}
for fn in sorted(glob.glob('vocab/*.txt')):
    for line in open(fn, encoding='utf-8'):
        line = line.rstrip('\n')
        if not line.strip():
            continue
        parts = [x.strip() for x in line.split('|')]
        al = parts[0]
        m = parts[1] if len(parts) > 1 else ''
        col = parts[2] if len(parts) > 2 else ''
        fam = parts[3] if len(parts) > 3 else ''
        if al in V:
            if m and m not in V[al]['m']:
                V[al]['m'] += '; ' + m
            if col and not V[al]['c']:
                V[al]['c'] = col
            if fam and not V[al]['f']:
                V[al]['f'] = fam
        else:
            V[al] = {'m': m, 'c': col, 'f': fam}

MARK = re.compile(r'\[([^|\]]+)(?:\|[^\]]+)?\]')

def clean_with_map(raw):
    out = []
    mp = [0] * (len(raw) + 1)
    pos = 0
    cl = 0
    for m in MARK.finditer(raw):
        for i in range(pos, m.start()):
            mp[i] = cl
            out.append(raw[i]); cl += 1
        surf = m.group(1)
        for i in range(m.start(), m.end()):
            mp[i] = cl
        out.append(surf); cl += len(surf)
        mp[m.end()] = cl
        pos = m.end()
    for i in range(pos, len(raw)):
        mp[i] = cl
        out.append(raw[i]); cl += 1
    mp[len(raw)] = cl
    return ''.join(out), mp

SENT = re.compile(r'[^.!?\n]*(?:[.!?]+["”’)]*|\n|$)')

def sentences(text):
    res = []
    for m in SENT.finditer(text):
        s, e = m.start(), m.end()
        seg = text[s:e]
        if seg.strip():
            # trim leading spaces
            lead = len(seg) - len(seg.lstrip())
            res.append((s + lead, e))
    return res

def word_label(x):
    w = x['word']
    if w == 'a, an':
        return 'a, an'
    return w

POS_VI = {}

import os
GRAM = json.load(open('gram.json', encoding='utf-8')) if os.path.exists('gram.json') else None
NOTES = json.load(open('notes.json', encoding='utf-8')) if os.path.exists('notes.json') else {}
QUIZ = json.load(open('quiz.json', encoding='utf-8')) if os.path.exists('quiz.json') else {}
from gcat import CAT as GCAT
out_paras = []
for pi, p in enumerate(paras):
    raw = p['en']
    clean, mp = clean_with_map(raw)
    items = []
    for al, (ap, st, en, ex) in assign.items():
        if ap == pi:
            items.append((mp[st], mp[en], al))
    items.sort()
    # drop overlaps (keep first)
    spans = []
    last_end = -1
    for s, e, al in items:
        if s < last_end:
            # overlapping (e.g. phrase vs single) -> still record word, no inline span
            spans.append((s, e, al, False))
            continue
        spans.append((s, e, al, True))
        last_end = e
    sents = sentences(clean)
    words = []
    for s, e, al, inline in spans:
        ex = ''
        for ss, se in sents:
            if ss <= s < se:
                sent = clean[ss:se].strip()
                rel_s = s - ss - (len(clean[ss:se]) - len(clean[ss:se].lstrip()))
                rel_s = s - ss
                sraw = clean[ss:se]
                lead = len(sraw) - len(sraw.lstrip())
                a0 = s - ss - lead
                a1 = e - ss - lead
                sent = sraw.strip()
                if 0 <= a0 < a1 <= len(sent):
                    ex = html.escape(sent[:a0]) + '<b>' + html.escape(sent[a0:a1]) + '</b>' + html.escape(sent[a1:])
                else:
                    ex = html.escape(sent)
                break
        words.append({'a': al, 'ex': ex, 'form': clean[s:e]})
    # sentence units EN<->VI (for dictation & back-translation)
    vi_s = [p['vi'][a:b].strip() for a, b in sentences(p['vi'])]
    assert len(vi_s) == len(sents), (p['n'], len(sents), len(vi_s))
    units = []
    for (a, b), v in zip(sents, vi_s):
        txt = clean[a:b].strip()
        first = re.sub(r'^["“‘\'(]+', '', txt)[:1]
        if units and first.islower():
            units[-1][1] = b
            units[-1][2] += ' ' + v
        else:
            units.append([a, b, v])
    ss = []
    for a, b, v in units:
        als = []
        for s, e, al, inl in spans:
            if a <= s < b and al not in als:
                als.append(al)
        ss.append([re.sub(r'\s+', ' ', clean[a:b]).strip(), re.sub(r'\s+', ' ', v).strip(), als])
    # ---- text HTML: sentence spans + word spans ----
    ev = []
    for k, (a, b, v) in enumerate(units):
        e2 = a + len(clean[a:b].rstrip())
        assert re.sub(r'\s+', ' ', clean[a:e2]) == ss[k][0], (p['n'], k)
        ev.append((a, 2, f'<span class="sn" data-s="{k}">'))
        ev.append((e2, 1, '</span>'))
    for s0, e0, al, inline in spans:
        if not inline:
            continue
        lv = BY[al]['level']
        ev.append((s0, 3, f'<span class="w {lv}" data-a="{html.escape(al)}">'))
        ev.append((e0, 0, '</span>'))
    ev.sort(key=lambda x: (x[0], x[1]))
    htmlparts = []
    pos = 0
    for at, _, tag in ev:
        htmlparts.append(html.escape(clean[pos:at]))
        htmlparts.append(tag)
        pos = at
    htmlparts.append(html.escape(clean[pos:]))
    body = ''.join(htmlparts)
    body = ''.join(f'<p>{x.strip()}</p>' for x in re.split(r'\n\s*\n', body) if x.strip())
    body = body.replace('\n', '<br>')
    vi = ''.join(f'<p>{html.escape(x.strip())}</p>' for x in re.split(r'\n\s*\n', p['vi']) if x.strip())
    vi = vi.replace('\n', '<br>')
    wc = len(re.findall(r"[A-Za-z]+(?:[-’'][A-Za-z]+)*", clean))
    gs = GRAM['s'].get(str(p['n'])) if GRAM else None
    if gs is not None:
        assert len(gs) == len(ss), ('grammar sentence mismatch', p['n'], len(gs), len(ss))
        for k, g in enumerate(gs):
            nt = NOTES.get(f"{p['n']}|{k}")
            if nt:
                g['n'] = nt
    out_paras.append({
        'n': p['n'], 'lv': p['level'], 't': p['title'], 'tv': p['title_vi'],
        'en': body, 'vi': vi, 'wc': wc,
        'gr': [[g[0].strip(), g[1].strip()] for g in p['gr']],
        'w': words,
        'ss': ss,
        'g': gs or [],
        'gp': (GRAM['p'].get(str(p['n'])) if GRAM else []) or [],
        'qz': QUIZ.get(str(p['n']), []),
    })

dic = {}
for x in W:
    al = x['alias']
    d = V[al]
    dic[al] = {
        'w': word_label(x), 's': x['sense'], 'p': x['pos'], 'l': x['level'],
        'm': d['m'], 'c': d['c'], 'f': d['f'],
        'src': x['src'],
    }

data = {'paras': out_paras, 'dict': dic, 'gcat': {k: list(v[:4]) for k, v in GCAT.items()}}
js = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
tpl = open('template.html', encoding='utf-8').read()
app = open('app.js', encoding='utf-8').read()
out = tpl.replace('/*__APP__*/', app).replace('/*__DATA__*/null', js)
open('out/oxford5000_doan_van.html', 'w', encoding='utf-8').write(out)
print('paragraphs', len(out_paras), 'dict', len(dic), 'bytes', len(out))
tot = sum(len(p['w']) for p in out_paras)
print('words total', tot)
print('no-example', sum(1 for p in out_paras for w in p['w'] if not w['ex']))
