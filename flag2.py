import glob, sys
pat = sys.argv[1]
for f in sorted(glob.glob(f'quiz/{pat}.txt')):
    n=None;k=-1
    for line in open(f,encoding='utf-8'):
        line=line.rstrip('\n')
        if line.startswith('==='): n=int(line[3:]); k=-1; continue
        if not line.strip(): continue
        k+=1
        p=line.split('|')
        if p[0]!='M': continue
        opts=p[2:6]; a='ABCD'.index(p[6]); L=[len(o) for o in opts]
        if L[a]==max(L) and L.count(max(L))==1:
            ds=' ¦ '.join(opts[i] for i in range(4) if i!=a)
            print(f"{n}|{k}| {p[1]}\n  ✓({L[a]}) {opts[a]}\n  ✗ {ds}")
