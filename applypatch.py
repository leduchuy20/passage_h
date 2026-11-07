import glob, re, sys
patch = {}
for f in glob.glob('quiz_patch/*.txt'):
    for line in open(f, encoding='utf-8'):
        line = line.rstrip('\n')
        if not line.strip(): continue
        p = line.split('|')
        assert len(p) == 5, (f, line)
        patch[(int(p[0]), int(p[1]))] = p[2:]
used = set()
for f in sorted(glob.glob('quiz/*.txt')):
    out = []; n = None; k = -1
    for line in open(f, encoding='utf-8'):
        raw = line.rstrip('\n')
        if raw.startswith('==='):
            n = int(raw[3:]); k = -1; out.append(raw); continue
        if not raw.strip():
            out.append(raw); continue
        k += 1
        p = raw.split('|')
        if p[0] == 'M' and (n, k) in patch:
            ds = patch[(n, k)]; a = 'ABCD'.index(p[6]); j = 0
            for i in range(4):
                if i != a:
                    p[2 + i] = ds[j]; j += 1
            used.add((n, k))
            raw = '|'.join(p)
        out.append(raw)
    open(f, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('applied', len(used), 'unused', sorted(set(patch) - used))
