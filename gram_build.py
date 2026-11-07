import json, re, math, sys
from collections import defaultdict, Counter
import spacy
from spacy.tokens import DocBin
from grammar import Analyzer, sentence_type, ADV_CONN
from patterns import detect
from gcat import CAT

LVN = {'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5}
TARGET = {'A1': 8, 'A2': 9, 'B1': 10, 'B2': 11, 'C1': 12}
CONN_CAT = dict(ADV_CONN)
PROLE = {'ccomp': 'O', 'csubj': 'S', 'csubjpass': 'S', 'advcl': 'A', 'relcl': 'M', 'acl': 'M', 'pcomp': 'P'}


def load_data():
    h = open('out/oxford5000_doan_van.html', encoding='utf-8').read()
    i = h.find('const DATA = ') + 13; j = h.find(';\nconst P = DATA')
    return json.loads(h[i:j])


def adv_cat(an, c):
    if c['type'] != 'adv':
        return ''
    t = c['tense']
    conn = c['extra']
    if not c['finite']:
        if conn and conn not in ('so', 'than', 'as'):
            return 'red'
        if t in ('ving', 'v3', 'ving_perf'):
            return 'part'
        if t == 'inf_to':
            return 'purp'
        return ''
    cat = CONN_CAT.get(conn, '')
    par = c['par']
    pt = an.clauses[par]['tense'] if par is not None else ''
    if cat == 'since':
        cat = 'time' if pt in ('pp', 'ppc', 'pap', 'papc') else 'reason'
    elif cat == 'while':
        a0 = c['span'][0]
        midc = an.doc.text[:an.toks[a0].idx].rstrip().endswith(',') and a0 > 2
        cat = 'conc' if (midc and t not in ('pc', 'pac')) else 'time'
    elif cat == 'as':
        cat = 'time' if t in ('pc', 'pac') else 'as'
    return cat


def analyse_all():
    d = load_data()
    nlp = spacy.blank('en')
    docs = list(DocBin().from_disk('parsed.spacy').get_docs(nlp.vocab))
    idx = json.load(open('parsed_index.json'))
    by_para = defaultdict(list)
    for doc, (n, k, off) in zip(docs, idx):
        by_para[n].append((k, off, doc))
    out = {}
    for p in d['paras']:
        n = p['n']
        items = sorted(by_para[n], key=lambda x: x[0])
        ans = []
        for k, off, doc in items:
            an = Analyzer(doc).finalize()
            an.amb_flag()
            ans.append((k, off, an))
        # paragraph-level fix for past/present-identical verbs (put, cut, set…)
        cnt = Counter()
        for _, _, an in ans:
            for c in an.clauses:
                if c['finite'] and not c.get('amb'):
                    if c['tense'] in ('ps', 'pc', 'pp', 'ppc'): cnt['p'] += 1
                    if c['tense'] in ('pa', 'pac', 'pap', 'papc'): cnt['a'] += 1
        major = 'ps' if cnt['p'] >= cnt['a'] else 'pa'
        for _, _, an in ans:
            for c in an.clauses:
                if c.get('amb'):
                    c['tense'] = major
        sents = []
        for k, off, an in ans:
            doc = an.doc
            stype = sentence_type(an.clauses)
            runs = [[a + off, b + off, r, ci] for a, b, r, ci in an.runs()]
            if off:
                runs.insert(0, [0, off - 2 if p['ss'][k][0][off - 2] == ':' else off - 1, 'L', -1])
            cls = []
            for c in an.clauses:
                h = c['h']
                a, b = c['span']
                ca = an.toks[a].idx + off; cb = an.toks[b].idx + len(an.toks[b].text) + off
                prole = ''
                if c['par'] is not None and c['type'] not in ('coord', 'parataxis'):
                    prole = PROLE.get(h.dep_, '')
                    if h.dep_ == 'xcomp':
                        prole = 'O' if h.pos_ in ('VERB', 'AUX') else 'C'
                cls.append([c['type'], c['extra'] or '', adv_cat(an, c), c['tense'] or '', 1 if c['voice'] else 0,
                            1 if c['finite'] else 0, -1 if c['par'] is None else c['par'], prole,
                            [[r, t] for r, t in an.role_text(c)], 1 if c['has_subj'] else 0, ca, cb])
            hits = [[key, a + off, b + off] for key, a, b in detect(an)]
            sents.append({'t': stype, 'r': runs, 'c': cls, 'k': hits})
        out[n] = sents
    return d, out


QUOTE = re.compile(r'"([^"]{3,})"|“([^”]{3,})”')
VI_CH = re.compile(r'[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹáàãéèíìóòõúùýđ]', re.I)


def norm(s):
    return s.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')


def locate_hand(p):
    """returns list of (pattern, expl, [[si,a,b],...])"""
    res = []
    sents = [norm(s[0]) for s in p['ss']]
    for pat, expl in p['gr']:
        occ = []
        quotes = [m.group(1) or m.group(2) for m in QUOTE.finditer(expl)]
        quotes = [q for q in quotes if not VI_CH.search(q)]
        for q in quotes:
            q = norm(q).strip()
            pieces = [x.strip(' .,') for x in re.split(r'\.\.\.|…', q) if len(x.strip(' .,')) >= 3]
            for piece in pieces[:1] if len(pieces) > 1 and len(pieces[0]) > 8 else pieces:
                for si, s in enumerate(sents):
                    pos = s.find(piece)
                    if pos < 0:
                        pos2 = s.lower().find(piece.lower())
                        pos = pos2
                    if pos >= 0:
                        occ.append([si, pos, pos + len(piece)])
                        break
        if not occ:
            # literal words of the pattern, e.g. "in many cases", "the other way round"
            alts = re.split(r'\s*/\s*', re.sub(r'\(.*?\)', '', pat))
            for alt in alts:
                lit = re.sub(r'\b(S|V|N|O|sb|sth|adj|adv|V-ing|to-V|V3|V2|V-ed|mệnh đề|N/V-ing)\b|\+|\.\.\.|…', ' ', alt)
                lit = re.sub(r'\s+', ' ', lit).strip(' ,.?')
                if len(lit) < 4 or not re.search(r'[a-zA-Z]{3,}', lit):
                    continue
                for si, s in enumerate(sents):
                    for m in re.finditer(r'\b' + re.escape(lit.lower()) + r'\b', s.lower()):
                        occ.append([si, m.start(), m.end()])
                if occ:
                    break
        res.append((pat, expl, occ))
    return res


HAND_MAP = [
    ('present perfect continuous', 't_ppc'), ('past perfect continuous', 't_papc'), ('present perfect', 't_pp'),
    ('past perfect', 't_pap'), ('present continuous', 't_pc'), ('past continuous', 't_pac'), ('present simple', 't_ps'),
    ('past simple', 't_pa'), ('used to', 't_used_to'), ('going to', 't_going_to'), ('bị động', 'passive'), ('passive', 'passive'),
    ('điều kiện loại 0', 'cond0'), ('điều kiện loại 1', 'cond1'), ('điều kiện loại 2', 'cond2'), ('điều kiện loại 3', 'cond3'),
    ('điều kiện hỗn hợp', 'cond_mixed'), ('mixed conditional', 'cond_mixed'), ('đảo ngữ', 'inversion'),
    ('mệnh đề quan hệ rút gọn', 'rel_reduced'), ('mệnh đề phân từ', 'participle'), ('so sánh nhất', 'superlative'),
    ('so sánh hơn', 'comparative'), ('câu tường thuật', 'reported'), ('reported speech', 'reported'), ('câu chẻ', 'cleft'),
    ('there is', 'there_be'), ('there are', 'there_be'), ('wish', 'wish'), ('mệnh lệnh', 't_imp'), ('imperative', 't_imp'),
]


def hand_key(pat, expl):
    s = (pat + ' ' + expl[:60]).lower()
    for k, key in HAND_MAP:
        if k in s:
            return key
    return None


def jacc(a, b):
    if a[0] != b[0]:
        return 0
    inter = max(0, min(a[2], b[2]) - max(a[1], b[1]))
    uni = max(a[2], b[2]) - min(a[1], b[1])
    return inter / uni if uni else 0


def select_points(p, sents):
    lv = LVN[p['lv']]
    hand = locate_hand(p)
    agg = defaultdict(list)
    for si, s in enumerate(sents):
        for key, a, b in s['k']:
            agg[key].append([si, a, b])
    merged = set()
    hand2 = []
    for pat, expl, occ in hand:
        hk = hand_key(pat, expl)
        if hk and hk in agg:
            seen = {tuple(o) for o in occ}
            occ = occ + [o for o in agg[hk] if tuple(o) not in seen]
            occ.sort()
            merged.add(hk)
        hand2.append((pat, expl, occ))
    hand = hand2
    cands = []
    for key, occ in agg.items():
        if key in merged:
            continue
        name, form, expl, klv, w = CAT[key]
        diff = lv - LVN[klv]
        f = 1.0 if 0 <= diff <= 1 else (0.6 ** (diff - 1) if diff > 1 else 0.7 ** (-diff))
        score = w * f * (1 + 0.5 * math.log2(len(occ)))
        # drop if a hand-written point already covers it
        if any(jacc(o, ho) >= 0.5 for o in occ for _, _, hocc in hand for ho in hocc):
            continue
        cands.append((score, key, occ))
    cands.sort(reverse=True)
    n_auto = max(TARGET[p['lv']] - len(hand), 4)
    chosen = []
    tense_n = 0
    for score, key, occ in cands:
        if len(chosen) >= n_auto:
            break
        if key.startswith('t_'):
            if tense_n >= 4:
                continue
            tense_n += 1
        chosen.append((key, occ))
    if not any(k.startswith('t_') for k, _ in chosen):
        tens = sorted([(len(o), k, o) for _, k, o in cands if k.startswith('t_')], reverse=True)
        if tens:
            if len(chosen) >= n_auto:
                chosen.pop()
            chosen.append((tens[0][1], tens[0][2]))
    pts = [{'h': [pat, expl], 'o': occ} for pat, expl, occ in hand]
    pts += [{'k': key, 'o': occ} for key, occ in chosen]
    first = lambda pt: (pt['o'][0][0], pt['o'][0][1]) if pt['o'] else (999, 0)
    pts.sort(key=first)
    return pts, hand


if __name__ == '__main__':
    d, out = analyse_all()
    gp = {}
    nohand = []
    for p in d['paras']:
        pts, hand = select_points(p, out[p['n']])
        gp[p['n']] = pts
        for pat, expl, occ in hand:
            if not occ:
                nohand.append((p['n'], pat))
    json.dump({'s': out, 'p': gp}, open('gram.json', 'w', encoding='utf-8'), ensure_ascii=False)
    print('hand points without location:', len(nohand))
    for x in nohand[:60]:
        print('  ', x)
    tot = Counter();
    for n, pts in gp.items():
        tot[len(pts)] += 1
    print('points per para', sorted(tot.items()))
    kc = Counter(pt['k'] for pts in gp.values() for pt in pts if 'k' in pt)
    print(kc.most_common())
