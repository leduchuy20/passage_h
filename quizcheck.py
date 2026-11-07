"""Parse quiz/*.txt, validate against paragraph texts, write quiz.json."""
import json, re, glob, sys
from collections import Counter

h = open('out/oxford5000_doan_van.html', encoding='utf-8').read()
i = h.find('const DATA = ') + 13; j = h.find(';\nconst P = DATA'); d = json.loads(h[i:j])
P = {p['n']: p for p in d['paras']}


def norm(s):
    s = s.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"').replace('—', '-').replace('–', '-')
    return re.sub(r'\s+', ' ', s).strip()


def para_sents(p):
    return [norm(s[0]) for s in p['ss']]


def locate(p, quote):
    """returns [sentIdx, a, b] using original sentence offsets (norm keeps length except whitespace)."""
    q = norm(quote).strip(' .')
    if not q:
        return None
    for si, s in enumerate(p['ss']):
        orig = s[0]
        n = norm(orig)
        pos = n.find(q)
        if pos < 0:
            pos = n.lower().find(q.lower())
        if pos >= 0 and len(n) == len(orig):
            return [si, pos, pos + len(q)]
        if pos >= 0:
            return [si, 0, len(orig)]
    return None


def locate_all(p, quote):
    q = norm(quote).strip()
    if not q:
        return None
    one = locate(p, q)
    if one:
        return [one]
    parts = [x for x in re.split(r'(?<=[.!?]) ', q) if x.strip(' .')]
    if len(parts) > 1:
        locs = [locate(p, x) for x in parts]
        if all(locs):
            return locs
    return None


def parse():
    quiz = {}
    errs = []
    for f in sorted(glob.glob('quiz/*.txt')):
        n = None
        for ln, line in enumerate(open(f, encoding='utf-8'), 1):
            line = line.rstrip('\n')
            if not line.strip():
                continue
            if line.startswith('==='):
                n = int(line[3:].strip())
                quiz[n] = []
                continue
            parts = line.split('|')
            kind = parts[0]
            where = f'{f}:{ln} P{n}'
            if kind == 'M':
                if len(parts) != 9:
                    errs.append((where, 'M needs 9 fields', len(parts))); continue
                _, q, a, b, c, dd, ans, ex, quote = parts
                if ans not in 'ABCD' or len(ans) != 1:
                    errs.append((where, 'bad answer', ans)); continue
                loc = locate_all(P[n], quote) if quote else None
                if quote and not loc:
                    errs.append((where, 'quote not found', quote))
                quiz[n].append({'t': 'M', 'q': q, 'o': [a, b, c, dd], 'a': 'ABCD'.index(ans), 'e': ex, 'r': loc})
            elif kind == 'T':
                if len(parts) != 5:
                    errs.append((where, 'T needs 5 fields', len(parts))); continue
                _, q, ans, ex, quote = parts
                if ans not in ('T', 'F', 'NG'):
                    errs.append((where, 'bad TFNG', ans)); continue
                loc = locate_all(P[n], quote) if quote else None
                if quote and not loc:
                    errs.append((where, 'quote not found', quote))
                if ans != 'NG' and not quote:
                    errs.append((where, 'T/F needs quote'))
                quiz[n].append({'t': 'T', 'q': q, 'a': ['T', 'F', 'NG'].index(ans), 'e': ex, 'r': loc})
            elif kind == 'O':
                if len(parts) != 4:
                    errs.append((where, 'O needs 4 fields', len(parts))); continue
                _, q, hint, rng = parts
                lo, hi = map(int, rng.split('-'))
                quiz[n].append({'t': 'O', 'q': q, 'h': hint, 'w': [lo, hi]})
            else:
                errs.append((where, 'unknown kind', kind))
    for n, qs in quiz.items():
        c = Counter(q['t'] for q in qs)
        if (c['M'], c['T'], c['O']) != (5, 4, 1):
            errs.append((f'P{n}', 'composition', dict(c)))
        tf = Counter(q['a'] for q in qs if q['t'] == 'T')
        if len(tf) < 2:
            errs.append((f'P{n}', 'TFNG all same', dict(tf)))
    return quiz, errs


def shuffle_opts(quiz):
    import random
    for n, qs in quiz.items():
        for k, q in enumerate(qs):
            if q['t'] != 'M':
                continue
            rnd = random.Random(f'ox5k-{n}-{k}')
            order = list(range(4)); rnd.shuffle(order)
            q['o'] = [q['o'][x] for x in order]
            q['a'] = order.index(q['a'])


if __name__ == '__main__':
    quiz, errs = parse()
    shuffle_opts(quiz)
    for e in errs:
        print('ERR', *e)
    am = Counter('ABCD'[q['a']] for qs in quiz.values() for q in qs if q['t'] == 'M')
    at = Counter(['T', 'F', 'NG'][q['a']] for qs in quiz.values() for q in qs if q['t'] == 'T')
    print('paras', len(quiz), 'MCQ answers', dict(sorted(am.items())), 'TFNG', dict(at))
    json.dump({str(k): v for k, v in quiz.items()}, open('quiz.json', 'w', encoding='utf-8'), ensure_ascii=False)
