import json, re, glob, sys
from collections import defaultdict, Counter
from lemminflect import getAllInflections, getAllInflectionsOOV

LV = {'A1': 0, 'A2': 1, 'B1': 2, 'B2': 3, 'C1': 4}
W = json.load(open('words.json'))
BYALIAS = {x['alias']: x for x in W}
CASE = {'IT', 'May', 'March'}

def base_lower(x):
    return x['word'].lower()

bc = Counter(base_lower(x) for x in W)
AMBIG_BASES = {b for b, c in bc.items() if c > 1}  # need explicit marks
# tokens whose exact form is an item but usually an inflection of another item
DUAL = {'found': 'find', 'left': 'leave', 'rose': 'rise', 'lay': 'lie1', 'saw': 'see', 'felt': 'feel'}
for k in list(DUAL):
    if k not in BYALIAS: del DUAL[k]

def forms(word):
    fs = {word}
    try:
        for v in getAllInflections(word).values(): fs.update(v)
    except Exception: pass
    if len(fs) == 1:
        for upos in ('NOUN', 'VERB', 'ADJ'):
            try:
                for v in getAllInflectionsOOV(word, upos).values(): fs.update(v)
            except Exception: pass
    return {f.lower() for f in fs}

# token -> list of aliases (auto)
TOK = defaultdict(set)
PHRASES = []  # (tuple tokens variants, alias)
for x in W:
    a = x['alias']; b = base_lower(x)
    if b in AMBIG_BASES and a not in ('it', 'may', 'march'):
        continue
    if a in CASE: continue
    if a == 'a':
        TOK['a'].add('a'); TOK['an'].add('a'); continue
    if ' ' in b:
        parts = b.split()
        for f in forms(parts[0]):
            PHRASES.append((tuple([f] + parts[1:]), a))
        continue
    if a == 'a':
        TOK['a'].add('a'); TOK['an'].add('a'); continue
    if b in DUAL: continue
    for f in forms(b):
        if f in BYALIAS and f != b and BYALIAS[f]['word'].lower() == f and f not in DUAL:
            continue  # exact item exists for this form (e.g. 'better')
        TOK[f].add(a)
for d, tgt in DUAL.items():
    if tgt in BYALIAS: TOK[d].add(tgt)
PHRASES.sort(key=lambda p: -len(p[0]))
TOK['added'].discard('ad'); TOK['adding'].discard('ad')
for _al in ('means','being','passing','living'):
    for _k in list(TOK):
        TOK[_k].discard(_al)

TOKRE = re.compile(r"\[[^\]]+\]|[A-Za-z]+(?:[-’'][A-Za-z]+)*")
CONTR = {"won": "will", "can": "can1", "shan": "shall"}

def tokenize(text):
    """returns list of (start,end,surface,explicit_alias_or_None, lowered)"""
    out = []
    for m in TOKRE.finditer(text):
        s = m.group(0)
        if s.startswith('['):
            inner = s[1:-1]
            if '|' in inner: surf, al = inner.split('|', 1)
            else: surf, al = inner, None
            out.append((m.start(), m.end(), surf, al if al else '__SELF__', surf.lower()))
        else:
            out.append((m.start(), m.end(), s, None, s.lower()))
    return out

def resolve_self(surf):
    if surf in CASE: return surf
    l = surf.lower()
    if l in BYALIAS: return l
    if l == 'an': return 'a'
    c = TOK.get(l)
    if c and len(c) == 1: return next(iter(c))
    return None

def parse_files():
    paras = []
    for fn in sorted(glob.glob('paras/*.txt')):
        txt = open(fn, encoding='utf-8').read()
        for blk in re.split(r'^=== ', txt, flags=re.M)[1:]:
            head, body = blk.split('\n', 1)
            n, lv, te, tv = [h.strip() for h in head.split('|')]
            sec = {}
            cur = None
            for line in body.split('\n'):
                if line.strip() in ('EN:', 'VI:', 'GR:', 'TIP:'):
                    cur = line.strip()[:-1]; sec[cur] = []; continue
                if cur: sec[cur].append(line)
            p = dict(n=int(n), level=lv, title=te, title_vi=tv, file=fn,
                     en='\n'.join(sec.get('EN', [])).strip(),
                     vi='\n'.join(sec.get('VI', [])).strip(),
                     gr=[l.split('::', 1) for l in sec.get('GR', []) if '::' in l])
            paras.append(p)
    paras.sort(key=lambda p: p['n'])
    return paras

def analyze(paras, cap=62, verbose=True):
    errors = []
    occ = defaultdict(list)  # alias -> list of (pidx, start, end, explicit)
    for pi, p in enumerate(paras):
        toks = tokenize(p['en'])
        i = 0; plain = []
        while i < len(toks):
            st, en, surf, ex, low = toks[i]
            if ex is not None:
                al = resolve_self(surf) if ex == '__SELF__' else ex
                if al not in BYALIAS:
                    errors.append(f"P{p['n']}: unknown alias in [{surf}|{ex}] -> {al}")
                else:
                    occ[al].append((pi, st, en, True))
                i += 1; continue
            # phrase match
            matched = False
            for ph, al in PHRASES:
                L = len(ph)
                seg = toks[i:i + L]
                if len(seg) == L and all(t[3] is None for t in seg) and tuple(t[4] for t in seg) == ph:
                    occ[al].append((pi, st, seg[-1][1], False)); matched = True
                    break
            # single token (also counted even if phrase matched)
            key = surf if surf in CASE else low
            cands = set()
            if surf in CASE: cands = {surf}
            elif "'" in low or '’' in low:
                stem = re.split(r"[’']", low)[0]
                if low.endswith("n't") or low.endswith("n’t"):
                    stem = stem[:-1] if stem.endswith('n') and stem not in ('can',) else stem
                    stem = CONTR.get(stem, stem)
                if stem in BYALIAS: cands = {stem}
                else: cands = TOK.get(stem, set())
                if low in ("o’clock", "o'clock"): cands = {'o’clock'}
            else:
                cands = TOK.get(low, set())
            for al in cands:
                occ[al].append((pi, st, en, False))
            i += 1
    # assignment
    load = Counter(); assign = {}
    plv = [LV[p['level']] for p in paras]
    # explicit first
    for al, lst in occ.items():
        exp = [o for o in lst if o[3]]
        if exp:
            assign[al] = exp[0]; load[exp[0][0]] += 1
    items = []
    for al, lst in occ.items():
        if al in assign: continue
        ilv = LV[BYALIAS[al]['level']]
        cands = {}
        for o in lst:
            if plv[o[0]] >= ilv and o[0] not in cands: cands[o[0]] = o
        if cands: items.append((al, ilv, cands))
    items.sort(key=lambda t: (len(t[2]), -t[1]))
    for al, ilv, cands in items:
        under = [pi for pi in cands if load[pi] < cap]
        if under:
            pi = min(under, key=lambda q: (plv[q] - ilv, q))
        else:
            pi = min(cands, key=lambda q: (load[q], q))
        assign[al] = cands[pi]; load[pi] += 1
    missing = defaultdict(list)
    for x in W:
        if x['alias'] not in assign: missing[x['level']].append(x['alias'])
    if verbose:
        for e in errors: print('ERR', e)
        for pi, p in enumerate(paras):
            wc = len(re.findall(r"[A-Za-z]+(?:[-’'][A-Za-z]+)*", re.sub(r'\[([^|\]]+)(\|[^\]]+)?\]', r'\1', p['en'])))
            print(f"P{p['n']:>2} {p['level']} words={wc:>3} new={load[pi]:>3}  {p['title']}")
        tot = sum(len(v) for v in missing.values())
        print('covered', len(assign), '/', len(W), ' missing', tot)
    return assign, missing, errors

if __name__ == '__main__':
    paras = parse_files()
    assign, missing, errors = analyze(paras)
    show = sys.argv[1:] or []
    for lv in show:
        print(f'--- missing {lv} ({len(missing[lv])}):')
        print(' · '.join(missing[lv]))
