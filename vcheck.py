import json,glob,sys
W=json.load(open('words.json')); A={x['alias']:x for x in W}
V={}; bad=[]
for fn in sorted(glob.glob('vocab/*.txt')):
    for line in open(fn,encoding='utf-8'):
        line=line.rstrip('\n')
        if not line.strip(): continue
        parts=line.split('|')
        al=parts[0].strip()
        if al not in A: bad.append((fn,al)); continue
        V[al]=parts[1:]
print('unknown:',bad)
lv=sys.argv[1] if len(sys.argv)>1 else None
miss=[x['alias'] for x in W if x['alias'] not in V and (lv is None or x['level']==lv)]
print('defined',len(V),'missing',len(miss))
if lv: print(' · '.join(miss))
