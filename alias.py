import json,re
from collections import Counter
w=json.load(open('words.json'))
TAG={'bank (money)':'bank:money','bank (river)':'bank:river','kind (type)':'kind:type','kind (caring)':'kind:caring',
'last1 (final)':'last:final','last1 (taking time)':'last:time','light (from the sun/a lamp)':'light:lamp','light (not heavy)':'light:weight',
'like (similar)':'like:prep','like (find sb/sth pleasant)':'like:enjoy','second1 (next after the first)':'second:next','second1 (unit of time)':'second:time',
'bear (animal)':'bear:animal','bear (deal with)':'bear:deal','mine (belongs to me)':'mine:my','mine (hole in the ground)':'mine:hole',
'race (competition)':'race:contest','race (people)':'race:people','rest (remaining part)':'rest:remain','rest (sleep/relax)':'rest:relax',
'rock (stone)':'rock:stone','rock (music)':'rock:music','set (put)':'set:put','set (group)':'set:group','stick (push into/attach)':'stick:attach',
'stick (piece of wood)':'stick:wood','counter (long flat surface)':'counter:surface','counter (argue against)':'counter:argue',
'grave (for dead person)':'grave:tomb','grave (serious)':'grave:serious','strip (long narrow piece)':'strip:piece','strip (remove clothes/a layer)':'strip:remove',
'match (contest/correspond)':'match','lie2 (tell a lie)':'lie2','a, an':'a'}
def base(k): return re.sub(r'\d+$','',re.sub(r'\s*\(.*\)','',k)).strip()
cnt=Counter(base(x['key']) for x in w)
for x in w:
    k=x['key']
    if k in TAG: a=TAG[k]
    elif cnt[base(k)]==1: a=base(k).lower()
    else: a=k.lower()
    x['alias']=a; x['word']=base(k)
    m=re.search(r'\((.*)\)',k); x['sense']=m.group(1) if m else ''
al=Counter(x['alias'] for x in w); print([a for a,c in al.items() if c>1])
print([x['alias'] for x in w if re.search(r'\d',x['alias'])])
json.dump(w,open('words.json','w'),ensure_ascii=False,indent=0)
