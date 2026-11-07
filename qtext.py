import json, sys, re
h = open('out/oxford5000_doan_van.html', encoding='utf-8').read()
i = h.find('const DATA = ') + 13; j = h.find(';\nconst P = DATA'); d = json.loads(h[i:j])
a, b = int(sys.argv[1]), int(sys.argv[2])
for p in d['paras']:
    if a <= p['n'] <= b:
        txt = re.sub(r'<[^>]+>', '', p['en'].replace('</p><p>', '\n').replace('<br>', '\n'))
        txt = txt.replace('&quot;', '"').replace('&#x27;', "'").replace('&amp;', '&')
        print(f"=== {p['n']} {p['lv']} | {p['t']}\n{txt}\n")
