import check,sys
from collections import Counter
p=check.parse_files(); a,m,e=check.analyze(p,verbose=False)
for x in e: print(x)
print({L:len(m[L]) for L in ['A1','A2','B1','B2','C1']}, 'covered',len(a))
c=Counter((a[x][0], check.BYALIAS[x]['level']) for x in a)
start=int(sys.argv[1]) if len(sys.argv)>1 else 0
for i in range(start,len(p)): print(p[i]['n'], {L:c[(i,L)] for L in ['A1','A2','B1','B2','C1'] if c[(i,L)]})
