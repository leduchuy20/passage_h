import glob, sys
from collections import defaultdict
st = defaultdict(lambda: [0, 0])
for f in sorted(glob.glob('quiz/*.txt')):
    lv = f.split('/')[-1][:2]
    for line in open(f, encoding='utf-8'):
        p = line.rstrip('\n').split('|')
        if p[0] != 'M': continue
        L = [len(o) for o in p[2:6]]; a = 'ABCD'.index(p[6])
        st[lv][1] += 1
        if L[a] == max(L) and L.count(max(L)) == 1: st[lv][0] += 1
for lv, (x, t) in sorted(st.items()): print(lv, f'{x}/{t} = {round(x/t*100)}%')
