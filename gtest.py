import json, sys, spacy
from spacy.tokens import DocBin
from grammar import Analyzer, sentence_type, TENSE_NAMES
from patterns import detect
nlp = spacy.blank('en')
docs = list(DocBin().from_disk('parsed.spacy').get_docs(nlp.vocab))
idx = json.load(open('parsed_index.json'))
def show(k):
    doc = docs[k]; an = Analyzer(doc).finalize()
    print('\n#', idx[k], doc.text)
    print('  type:', sentence_type(an.clauses))
    for c in an.clauses:
        print(f"  MĐ{c['i']+1} {c['type']}({c['extra']}) par={None if c['par'] is None else c['par']+1} tense={c['tense']} pass={c['voice']} fin={c['finite']}")
        print('     ', ' | '.join(f'{r}: {t}' for r, t in an.role_text(c)))
    print('  runs:', ' '.join(f"[{r}{ci+1}:{doc.text[a:b]}]" for a,b,r,ci in an.runs()))
    print('  pts:', [(k, doc.text[a:b]) for k,a,b in detect(an)])
for a in sys.argv[1:]:
    if '-' in a:
        x,y=map(int,a.split('-')); [show(k) for k in range(x,y)]
    else: show(int(a))
