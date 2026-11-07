import re, json
POS = r'(?:n\.|v\.|adj\.|adv\.|prep\.|conj\.|det\.|pron\.|exclam\.|number|modal v\.|auxiliary v\.|indefinite article|definite article|infinitive marker)'
def parse(path, src):
    lines = open(path, encoding='utf-8').read().split('\n')
    out=[]; level=None; buf=[]
    clean=[]
    for l in lines:
        l=l.split('©')[0].rstrip()
        if not l.strip(): continue
        if l.startswith('The Oxford') : continue
        clean.append(l.strip())
    merged=[]
    for l in clean:
        if merged and (merged[-1].endswith(',') or merged[-1].endswith('/')):
            merged[-1]=merged[-1]+(' ' if merged[-1].endswith(',') else '')+l
        else: merged.append(l)
    for l in merged:
        if l in ('A1','A2','B1','B2','C1'): level=l; continue
        m=re.search(r'\s('+POS+r'.*)$', l)
        if not m: print('NOPOS',repr(l)); continue
        head=l[:m.start()].strip(); pos=m.group(1).strip()
        out.append(dict(head=head,pos=pos,level=level,src=src))
    return out
a=parse('r3.txt','3000'); b=parse('r5.txt','5000')
print(len(a),len(b))
from collections import Counter
print(Counter(x['level'] for x in a), Counter(x['level'] for x in b))
# merge items by key = head (keeping digits & parens)
items={}
order=[]
for x in a+b:
    k=x['head']
    if k in items:
        items[k]['pos'] += '; '+x['pos']+' ('+x['level']+')'
    else:
        items[k]=dict(key=k,pos=x['pos'],level=x['level'],src=x['src']); order.append(k)
res=[items[k] for k in order]
print(len(res), Counter(x['level'] for x in res))
json.dump(res,open('words.json','w'),ensure_ascii=False,indent=0)
