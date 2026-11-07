import check,sys
p=check.parse_files(); a,m,e=check.analyze(p,verbose=False)
words=sys.argv[1].split()
print('missing:', ' '.join(w for w in words if w not in a))
print('this para new:', sum(1 for x in a if a[x][0]==len(p)-1))
