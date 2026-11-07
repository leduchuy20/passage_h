import json
from gcat import CAT
g = json.load(open('gram.json', encoding='utf-8'))
h = open('out/oxford5000_doan_van.html', encoding='utf-8').read()
i = h.find('const DATA = ') + 13; j = h.find(';\nconst P = DATA'); d = json.loads(h[i:j])
K = {'A1': 2, 'A2': 2, 'B1': 3, 'B2': 3, 'C1': 4}
TN = {'ps':'HTĐ','pc':'HTTD','pp':'HTHT','ppc':'HTHTTD','pa':'QKĐ','pac':'QKTD','pap':'QKHT','papc':'QKHTTD','fs':'TLĐ','fc':'TLTD','fp':'TLHT','going_to':'going to','used_to':'used to','imp':'mệnh lệnh'}
sel = {}
for p in d['paras']:
    ss = g['s'][str(p['n'])]
    sc = []
    for si, s in enumerate(ss):
        fin = sum(1 for c in s['c'] if c[5]); nf = sum(1 for c in s['c'] if not c[5] and c[0] != 'frag')
        hard = sum(CAT[k][4] for k, a, b in s['k'] if CAT[k][4] >= 5)
        L = len(p['ss'][si][0].split())
        score = fin * 1.5 + nf + L / 10 + hard / 3 + (1 if s['t'] in ('cc', 'complex') else 0)
        sc.append((score, si))
    sc.sort(reverse=True)
    pick = sorted(si for _, si in sc[:K[p['lv']]])
    sel[p['n']] = pick
json.dump(sel, open('hard_sel.json', 'w'))
for lv in K:
    with open(f'notes/todo_{lv}.txt', 'w', encoding='utf-8') as f:
        for p in d['paras']:
            if p['lv'] != lv: continue
            for si in sel[p['n']]:
                s = g['s'][str(p['n'])][si]
                f.write(f"### {p['n']}|{si}\nEN: {p['ss'][si][0]}\nVI: {p['ss'][si][1]}\n")
                for ci, c in enumerate(s['c']):
                    t = c[3]; t = TN.get(t, t)
                    f.write(f"  MĐ{ci+1} {c[0]}{'('+c[1]+')' if c[1] else ''}{'['+c[2]+']' if c[2] else ''} {t}{' BĐ' if c[4] else ''} :: " + ' | '.join(f'{r}={x}' for r, x in c[8]) + '\n')
                f.write('  pts: ' + ', '.join(sorted({k for k, a, b in s['k'] if not k.startswith('t_')})) + '\n')
print({lv: sum(len(sel[p['n']]) for p in d['paras'] if p['lv'] == lv) for lv in K})
