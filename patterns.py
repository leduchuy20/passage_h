"""Detect grammar points (key, start_char, end_char) in an analysed sentence."""
import re
from grammar import REPORT_VERBS, SUBJUNCTIVE_VERBS, LINKERS, NEG_FRONT, SUBJ, OBJ, VERBAL

WH = {'what', 'who', 'whom', 'where', 'when', 'why', 'how', 'which', 'whether', 'if', 'whatever', 'whoever',
      'whichever', 'however', 'wherever', 'whenever'}
REL_WORDS = {'who', 'whom', 'which', 'that', 'whose', 'where', 'when', 'why'}
PERCEPTION = {'see', 'hear', 'watch', 'notice', 'feel', 'smell', 'observe'}
CAUSATIVE = {'make', 'let', 'have', 'help', 'get'}


def detect(an):
    doc = an.doc
    toks = an.toks
    text = doc.text
    hits = []

    def add(key, a, b):
        if a is None or b is None or b <= a:
            return
        hits.append((key, a, b))

    def tspan(i, j):
        return toks[i].idx, toks[j].idx + len(toks[j].text)

    def pred_span(c):
        v = sorted(c['pset'])
        return tspan(v[0], v[-1])

    def clause_span(c):
        a, b = c['span']
        return tspan(a, b)

    by_head = {c['h'].i: c for c in an.clauses}
    first_word = lambda c: toks[c['span'][0]].lower_

    for c in an.clauses:
        h = c['h']
        t = c['tense']
        ps = pred_span(c)
        # ---- tenses ----
        if c['finite'] and t:
            if t in ('ps', 'pc', 'pp', 'ppc', 'pa', 'pac', 'pap', 'papc', 'fs', 'fc', 'fp', 'fpc', 'going_to', 'used_to', 'imp'):
                add('t_' + t, *ps)
            elif t.startswith('mp:'):
                add('modal_perfect', *ps)
            elif t.startswith('m:'):
                m = t[2:]
                key = {'can': 'modal_can', 'could': 'modal_can', 'may': 'modal_may', 'might': 'modal_may',
                       'must': 'modal_must', 'have_to': 'modal_must', 'had_to': 'modal_must', 'need': 'modal_must',
                       'should': 'modal_should', 'ought': 'modal_should', 'supposed_to': 'modal_should',
                       'would': 'modal_would', 'shall': 'modal_shall'}.get(m)
                if key:
                    add(key, *ps)
        if c['voice'] and (c['finite'] or t in ('inf_to', 'ving', 'ving_perf')) and c['type'] not in ('reduced_rel',):
            add('passive', *ps)

        ty = c['type']
        cs = clause_span(c)
        fw = first_word(c)
        # ---- relative clauses ----
        if ty == 'rel':
            a = c['span'][0]
            prev = text[:toks[a].idx].rstrip()
            nondef = prev.endswith(',') or prev.endswith('—') or prev.endswith('(')
            words = [toks[k].lower_ for k in range(a, min(a + 3, c['span'][1] + 1))]
            zero = words[0] not in REL_WORDS and not nondef and not (toks[a].dep_ == 'prep' or toks[a].pos_ == 'ADP')
            if not zero:
                add('rel_nondef' if nondef else 'rel_def', *cs)
            if 'whose' in words[:2]:
                add('rel_whose', *cs)
            elif words[0] in ('where', 'when', 'why'):
                add('rel_where', *cs)
            elif toks[a].dep_ == 'prep' or (len(words) > 1 and toks[a].pos_ == 'ADP' and words[1] in ('which', 'whom')):
                add('rel_prep', *cs)
            elif words[0] not in REL_WORDS and not nondef:
                add('rel_zero', *cs)
        elif ty == 'reduced_rel':
            add('rel_reduced', *cs)
        elif ty == 'acl_to':
            add('noun_to', *cs)
        elif ty == 'noun':
            par = h.head
            if not c['finite']:
                if h.tag_ == 'VB' and c['has_subj'] and par.lemma_.lower() in SUBJUNCTIVE_VERBS and \
                        not any(x.lower_ == 'to' for x in [toks[i] for i in c['pset']]):
                    add('subjunctive', *cs)
                elif c['has_subj'] and par.lemma_.lower() in ('make', 'let', 'have', 'help') and h.tag_ == 'VB':
                    add('causative_bare', tspan(min(par.i, c['span'][0]), c['span'][1])[0], cs[1])
                elif c['has_subj'] and par.lemma_.lower() in PERCEPTION and h.tag_ in ('VB', 'VBG'):
                    add('perception', tspan(par.i, par.i)[0], cs[1])
                elif c['has_subj'] and par.lemma_.lower() in ('have', 'get') and h.tag_ == 'VBN':
                    add('causative_have', tspan(par.i, par.i)[0], cs[1])
            else:
                quoted = '"' in text[max(0, toks[c['span'][0]].idx - 2):cs[1] + 2] or '“' in text[max(0, toks[c['span'][0]].idx - 2):cs[1] + 2]
                if fw in WH:
                    add('noun_wh', *cs)
                else:
                    add('noun_that', *cs)
                pc = by_head.get(an.clause_of[par.i])
                if par.lemma_.lower() in REPORT_VERBS and not quoted and (fw not in WH or par.lemma_.lower() == 'ask' or fw in ('if', 'whether')) and pc and pc['tense'] in ('pa', 'pap', 'pac') and t in ('pa', 'pac', 'pap', 'papc', 'm:would', 'm:could', 'm:might', 'm:had_to', 'mp:would', 'mp:could'):
                    add('reported', tspan(par.i, par.i)[0], cs[1])
                if par.lemma_.lower() == 'wish':
                    add('wish', tspan(par.i, par.i)[0], cs[1])
        elif ty == 'noun_subj':
            if fw == 'what' and h.head.lemma_ == 'be':
                add('pseudo_cleft', *cs)
            elif h.tag_ == 'VBG':
                add('gerund_subject', *cs)
            elif t == 'inf_to':
                add('noun_to', *cs)
            else:
                add('noun_wh' if fw in WH else 'noun_that', *cs)
        elif ty == 'xcomp':
            par = h.head
            if t == 'inf_to':
                if par.pos_ == 'ADJ' or par.dep_ == 'acomp':
                    adv = [x.lower_ for x in par.children if x.dep_ == 'advmod']
                    if 'too' in adv or 'enough' in adv:
                        add('too_enough', tspan(par.i, par.i)[0], cs[1])
                    else:
                        add('adj_to', tspan(par.i, par.i)[0], cs[1])
                elif any(x.dep_ in OBJ for x in par.children if x.i < h.i):
                    add('verb_obj_to', tspan(par.i, par.i)[0], cs[1])
                else:
                    add('verb_to', tspan(par.i, par.i)[0], cs[1])
            elif t in ('ving', 'ving_perf'):
                add('verb_ing', tspan(par.i, par.i)[0], cs[1])
            elif t == 'inf_bare' and par.lemma_.lower() in ('make', 'let', 'help', 'have'):
                add('causative_bare', tspan(par.i, par.i)[0], cs[1])
        elif ty == 'pcomp':
            if t in ('ving', 'ving_perf'):
                prep = h.head
                add('prep_ving', tspan(prep.i, prep.i)[0], cs[1])
        elif ty == 'adv':
            conn = c['extra']
            par_c = by_head.get(an.clause_of[h.head.i]) if h.head.i in an.clause_of else None
            pt = par_c['tense'] if par_c else ''
            if not c['finite']:
                if conn and conn not in ('so', 'than', 'as'):
                    add('reduced_adv', *cs)
                elif t in ('ving', 'v3'):
                    add('participle', *cs)
                elif t == 'ving_perf':
                    add('participle_perfect', *cs)
                elif t == 'inf_to':
                    add('inf_purpose', *cs)
                continue
            if conn in ('if',):
                ic = t
                k = 'cond_other'
                if ic in ('ps', 'pc', 'pp') and (pt in ('fs', 'fc', 'going_to', 'imp') or pt in ('m:can', 'm:may', 'm:might', 'm:must', 'm:should', 'm:have_to')):
                    k = 'cond1'
                elif ic == 'ps' and pt == 'ps':
                    k = 'cond0'
                elif ic in ('pa', 'pac') and pt in ('m:would', 'm:could', 'm:might'):
                    k = 'cond2'
                elif ic in ('pap', 'papc') and pt.startswith('mp:'):
                    k = 'cond3'
                elif (ic == 'pap' and pt in ('m:would', 'm:could', 'm:might')) or (ic == 'pa' and pt.startswith('mp:')):
                    k = 'cond_mixed'
                add(k, *cs)
                if par_c and k != 'cond_other':
                    add(k, *pred_span(par_c))
            elif conn == 'unless':
                add('unless', *cs)
            elif conn in ('as long as', 'provided', 'provided that', 'providing', 'only if', 'in case'):
                add('as_long_as', *cs)
            elif conn in ('when', 'whenever', 'before', 'after', 'until', 'till', 'once', 'as soon as'):
                add('adv_time', *cs)
            elif conn == 'since':
                add('adv_time' if pt in ('pp', 'ppc', 'pap', 'papc') else 'adv_reason', *cs)
            elif conn == 'while':
                midc = text[:toks[c['span'][0]].idx].rstrip().endswith(',') and c['span'][0] > 2
                add('adv_concession' if (midc and t not in ('pc', 'pac')) else 'adv_time', *cs)
            elif conn in ('although', 'though', 'even though', 'even if', 'whereas'):
                add('adv_concession', *cs)
            elif conn in ('because', 'now that'):
                add('adv_reason', *cs)
            elif conn in ('so that', 'in order that'):
                add('adv_purpose', *cs)
            elif conn in ('as if', 'as though'):
                add('as_if', *cs)
            elif conn == 'as':
                add('adv_time' if t in ('pc', 'pac') else 'adv_as', *cs)
            elif conn in ('where', 'wherever'):
                add('adv_place', *cs)
            elif conn is None and fw in ('had', 'should', 'were') and c['has_subj']:
                add('cond_inverted', *cs)

    # ---- sentence-level patterns ----
    sent = text
    low = sent.lower()
    root = [x for x in toks if x.dep_ == 'ROOT'][0]
    # questions
    if sent.rstrip(' "”’\'').endswith('?'):
        add('question', 0, len(sent.rstrip()))
    # there is / are
    for x in toks:
        if x.dep_ == 'expl' and x.lower_ == 'there':
            add('there_be', x.idx, x.head.idx + len(x.head.text))
    # it + be + adj/noun + to-V / that  (extraposition) and cleft
    for c in an.clauses:
        h = c['h']
        if h.lemma_.lower() not in ('be', 'seem', 'appear', 'become'):
            continue
        subj = [x for x in h.children if x.dep_ in ('nsubj', 'expl') and x.lower_ == 'it']
        if not subj:
            continue
        attr = [x for x in h.children if x.dep_ in ('attr', 'acomp')]
        comp = [x for x in h.children if x.dep_ in ('xcomp', 'ccomp', 'csubj')]
        if attr and any(r.dep_ == 'relcl' and an.toks[min(y.i for y in r.subtree)].lower_ in ('that', 'who', 'which') for a in attr for r in a.children) and attr[0].pos_ in ('NOUN', 'PROPN', 'PRON', 'ADV', 'ADP'):
            add('cleft', subj[0].idx, clause_span(c)[1])
        elif attr and comp:
            add('it_adj_to', subj[0].idx, clause_span(c)[1])
    # comparatives / superlatives
    for k, x in enumerate(toks):
        if x.tag_ in ('JJR', 'RBR') and x.lower_ not in ('more', 'less', 'fewer', 'rather') or \
                (x.lower_ in ('more', 'less') and k + 1 < len(toks) and toks[k + 1].tag_ in ('JJ', 'RB')):
            end = k + 1 if x.lower_ in ('more', 'less') else k
            th = next((j for j in range(end + 1, min(end + 6, len(toks))) if toks[j].lower_ == 'than'), None)
            if k > 0 and toks[k - 1].lower_ == 'the' and (k < 3):
                add('the_more', *tspan(k - 1, end))
            else:
                add('comparative', *tspan(k, th if th else end))
        elif x.tag_ in ('JJS', 'RBS') and x.lower_ not in ('most', 'least') or \
                (x.lower_ in ('most', 'least') and k + 1 < len(toks) and toks[k + 1].tag_ in ('JJ', 'RB') and k > 0 and toks[k - 1].lower_ in ('the', 'my', 'your', 'his', 'her', 'our', 'their', 'its')):
            st = k - 1 if k > 0 and toks[k - 1].lower_ in ('the', 'my', 'your', 'his', 'her', 'our', 'their', 'its') else k
            end = k + 1 if x.lower_ in ('most', 'least') else k
            add('superlative', *tspan(st, end))
        elif x.lower_ == 'as' and k + 2 < len(toks) and toks[k + 1].tag_ in ('JJ', 'RB', 'JJR') and \
                any(toks[j].lower_ == 'as' for j in range(k + 2, min(k + 5, len(toks)))):
            j = next(j for j in range(k + 2, min(k + 5, len(toks))) if toks[j].lower_ == 'as')
            add('as_as', *tspan(k, j))
    # too ... to / ... enough to (if not already found)
    for k, x in enumerate(toks):
        if x.lower_ == 'too' and x.dep_ == 'advmod' and x.head.tag_ in ('JJ', 'RB') and \
                any(toks[j].lower_ == 'to' for j in range(k + 2, min(k + 6, len(toks)))):
            add('too_enough', *tspan(k, x.head.i))
        if x.lower_ == 'enough' and x.dep_ == 'advmod' and x.head.tag_ in ('JJ', 'RB') and k + 1 < len(toks) and toks[k + 1].lower_ == 'to':
            add('too_enough', *tspan(x.head.i, k + 1))
    # so/such ... that
    for k, x in enumerate(toks):
        if x.lower_ in ('so', 'such') and k + 1 < len(toks):
            j = next((j for j in range(k + 2, min(k + 9, len(toks))) if toks[j].lower_ == 'that' and toks[j].dep_ == 'mark'), None)
            if j and (x.lower_ == 'such' or toks[k + 1].tag_ in ('JJ', 'RB', 'JJR', 'DT')):
                add('so_such_that', *tspan(k, j))
    # paired conjunctions
    m = re.search(r'\b(both)\b[^.;]*?\band\b|\b(either)\b[^.;]*?\bor\b|\b(neither)\b[^.;]*?\bnor\b|\bnot only\b[^.;]*?\bbut\b', low)
    if m:
        pre = [x for x in toks if x.dep_ == 'preconj']
        if pre or 'not only' in m.group(0):
            add('paired_conj', m.start(), m.end())
    # inversion
    if not sent.rstrip(' "”’\'').endswith('?'):
        st = 0
        while st < len(toks) and toks[st].is_punct:
            st += 1
        fin = None
        for c in an.clauses:
            if c['h'].dep_ == 'ROOT':
                subj = [x for x in c['h'].children if x.dep_ in ('nsubj', 'nsubjpass')]
                v = sorted(c['pset'])
                if subj and v and v[0] < subj[0].i and toks[st].lower_ in NEG_FRONT and toks[st].lower_ not in ('here', 'there') and \
                        c['h'].lemma_.lower() not in REPORT_VERBS and toks[st].i != v[0]:
                    add('inversion', toks[st].idx, subj[0].idx + len(subj[0].text))
        if low.lstrip('"“ ').startswith(('not only', 'never have', 'never had', 'rarely', 'seldom', 'little did', 'only when', 'only after', 'only then', 'hardly', 'no sooner', 'not until', 'under no')):
            a = len(sent) - len(sent.lstrip('"“ '))
            if not any(hh[0] == 'inversion' for hh in hits):
                add('inversion', a, min(len(sent), a + 40))
    # linkers
    for lk in sorted(LINKERS, key=len, reverse=True):
        for mm in re.finditer(r'(^|[;:—]\s*|,\s*)["“]?(' + re.escape(lk) + r')\b(?=,|\s)', low):
            a = mm.start(2); b = mm.end(2)
            if lk in ('still', 'finally', 'first of all', 'of course', 'as well', 'at least', 'instead', 'indeed', 'overall') and not text[b:b + 1] == ',':
                continue
            if not any(h[0] == 'linkers' and h[1] <= a < h[2] for h in hits):
                add('linkers', a, b)
    # phrasal verbs
    for x in toks:
        if x.dep_ == 'prt' and x.head.pos_ == 'VERB':
            v = x.head
            a, b = (v.i, x.i) if v.i < x.i else (x.i, v.i)
            if b - a <= 4:
                add('phrasal', *tspan(a, b))
    # be/get used to + V-ing
    for mm in re.finditer(r"\b(be|am|is|are|was|were|been|being|get|got|getting|gets|become|became)\s+(?:\w+\s+)?used to\b", low):
        add('be_used_to', mm.start(), mm.end())
    for mm in re.finditer(r"\b(would rather|had better|'d rather|'d better)\b", low):
        add('would_rather', mm.start(), mm.end())
    for mm in re.finditer(r"\b(would like|would love|'d like|'d love)\b", low):
        add('would_like', mm.start(), mm.end())
    for mm in re.finditer(r"\bif only\b", low):
        add('wish', mm.start(), mm.end())
    for mm in re.finditer(r"\bno matter (how|what|who|where|when|whether)\b", low):
        add('no_matter', mm.start(), mm.end())
    # emphatic do
    for c in an.clauses:
        pt = [toks[i] for i in sorted(c['pset'])]
        if any(x.lemma_.lower() == 'do' and x.dep_ == 'aux' for x in pt) and not any(x.dep_ == 'neg' for x in pt) and \
                not sent.rstrip(' "”’\'').endswith('?') and c['has_subj'] and c['tense'] != 'imp':
            subj = [x for x in c['h'].children if x.dep_ in SUBJ]
            d = [x for x in pt if x.lemma_.lower() == 'do'][0]
            if subj and subj[0].i < d.i:
                add('emphatic_do', *tspan(d.i, c['h'].i))
    # gerund subject (nsubj VBG noun)
    for x in toks:
        if x.dep_ in ('nsubj',) and x.tag_ == 'VBG' and x.i in an.headset is False:
            add('gerund_subject', *tspan(min(y.i for y in x.subtree), max(y.i for y in x.subtree)))
    # appositive
    for x in toks:
        if x.dep_ == 'appos':
            sub = sorted(x.subtree, key=lambda y: y.i)
            before = text[:sub[0].idx].rstrip()
            hsub = sorted(x.head.subtree, key=lambda y: y.i)
            if len(sub) >= 2 and (before.endswith(',') or before.endswith('(') or before.endswith('—')) and \
                    sub[0].lower_ != hsub[0].lower_ and x.head.pos_ in ('NOUN', 'PROPN') and ':' not in text[:sub[0].idx]:
                add('appositive', *tspan(sub[0].i, sub[-1].i))
    # dedupe
    seen = set(); out = []
    for k in sorted(hits, key=lambda h: (h[1], h[2], h[0])):
        if k in seen:
            continue
        seen.add(k); out.append(list(k))
    return out
