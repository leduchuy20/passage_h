"""Clause / role analysis + grammar pattern detection on spaCy (ClearNLP-style) parses."""
import re

SUBJ = {'nsubj', 'nsubjpass', 'csubj', 'csubjpass', 'expl'}
OBJ = {'dobj', 'dative', 'obj', 'iobj'}
COMP = {'attr', 'acomp', 'oprd'}
ADV = {'prep', 'advmod', 'npadvmod', 'agent', 'advcl', 'tmod', 'obl', 'nmod'}
CONN = {'mark', 'cc', 'preconj'}
INTJ = {'intj', 'discourse'}
CLAUSE_DEPS = {'ROOT', 'advcl', 'relcl', 'ccomp', 'csubj', 'csubjpass', 'xcomp', 'acl', 'pcomp', 'parataxis', 'conj'}
VERBAL = {'VERB', 'AUX'}
FINITE_TAGS = {'VBD', 'VBZ', 'VBP', 'MD'}
REPORT_VERBS = {'say', 'tell', 'explain', 'admit', 'claim', 'report', 'reply', 'answer', 'promise', 'warn', 'ask',
                'announce', 'insist', 'complain', 'add', 'mention', 'argue', 'shout', 'whisper', 'write', 'agree', 'deny',
                'confess', 'remind', 'suggest', 'point', 'note', 'state', 'assure', 'inform'}
SUBJUNCTIVE_VERBS = {'suggest', 'recommend', 'insist', 'demand', 'propose', 'require', 'request', 'ask', 'urge'}

# multiword connectors at the start of adverbial clauses (lowercase), longest first
ADV_CONN = [
    ('as soon as', 'time'), ('as long as', 'cond'), ('even though', 'conc'), ('even if', 'conc'), ('in case', 'cond'),
    ('so that', 'purp'), ('in order that', 'purp'), ('as if', 'manner'), ('as though', 'manner'), ('now that', 'reason'),
    ('provided that', 'cond'), ('provided', 'cond'), ('providing', 'cond'), ('only if', 'cond'), ('unless', 'cond'),
    ('if', 'cond'), ('although', 'conc'), ('though', 'conc'), ('whereas', 'conc'), ('because', 'reason'),
    ('since', 'since'), ('when', 'time'), ('whenever', 'time'), ('while', 'while'), ('before', 'time'), ('after', 'time'),
    ('until', 'time'), ('till', 'time'), ('once', 'time'), ('as', 'as'), ('where', 'place'), ('wherever', 'place'),
    ('than', 'comp'), ('so', 'result'), ('whether', 'cond'),
]
LINKERS = ['however', 'therefore', 'moreover', 'furthermore', 'nevertheless', 'nonetheless', 'consequently',
           'as a result', 'in addition', 'on the other hand', 'on the contrary', 'in other words', 'for example',
           'for instance', 'instead', 'otherwise', 'meanwhile', 'hence', 'thus', 'besides', 'in fact', 'after all',
           'above all', 'indeed', 'in short', 'in conclusion', 'to sum up', 'as a matter of fact', 'by contrast',
           'in contrast', 'similarly', 'likewise', 'finally', 'firstly', 'secondly', 'first of all', 'of course',
           'still', 'anyway', 'in the end', 'at the same time', 'as well', 'what is more', 'not to mention',
           'admittedly', 'ultimately', 'in particular', 'in general', 'overall', 'in any case', 'at least',
           'in the meantime', 'all in all', 'nonetheless', 'accordingly', 'conversely', 'notably']
NEG_FRONT = {'never', 'rarely', 'seldom', 'hardly', 'scarcely', 'barely', 'little', 'nowhere', 'only', 'not', 'no',
             'so', 'such', 'nor', 'neither', 'under', 'at', 'on', 'in', 'nearby', 'here', 'there', 'down', 'up', 'out',
             'away', 'off', 'beside', 'behind', 'above', 'below', 'outside', 'inside', 'among', 'around', 'along', 'into'}

TENSE_NAMES = {
    'ps': 'Hiện tại đơn', 'pc': 'Hiện tại tiếp diễn', 'pp': 'Hiện tại hoàn thành', 'ppc': 'Hiện tại hoàn thành tiếp diễn',
    'pa': 'Quá khứ đơn', 'pac': 'Quá khứ tiếp diễn', 'pap': 'Quá khứ hoàn thành', 'papc': 'Quá khứ hoàn thành tiếp diễn',
    'fs': 'Tương lai đơn (will)', 'fc': 'Tương lai tiếp diễn', 'fp': 'Tương lai hoàn thành', 'fpc': 'Tương lai hoàn thành tiếp diễn',
    'going_to': 'be going to + V', 'used_to': 'used to + V', 'imp': 'Câu mệnh lệnh',
    'inf_to': 'to + V (không chia thì)', 'inf_bare': 'V nguyên mẫu (không chia thì)', 'ving': 'V-ing (không chia thì)',
    'v3': 'V3/V-ed (không chia thì)',
}
MODAL_KEY = {'can': 'modal_can', 'could': 'modal_can', 'may': 'modal_may', 'might': 'modal_may', 'must': 'modal_must',
             'should': 'modal_should', 'ought': 'modal_should', 'would': 'modal_would', 'shall': 'modal_shall',
             'will': None, 'need': 'modal_must', 'dare': 'modal_can'}


def lower_text(toks):
    return ' '.join(t.lower_ for t in toks)


class Analyzer:
    def __init__(self, doc):
        self.doc = doc
        self.toks = list(doc)
        self.merged = {}   # xcomp token -> semi-modal label, treated as part of parent's verb group
        self._find_semimodals()
        self.heads = [t for t in self.toks if self._is_clause_head(t)]
        self.semi_coord = set()
        self.semi_punct = {}
        self.quoted = set()
        txt = doc.text
        for t in self.heads:
            if t.dep_ in ('ccomp', 'parataxis'):
                sub = list(t.subtree)
                a = min(x.i for x in sub); b = max(x.i for x in sub)
                if b < t.head.i:
                    gap = txt[self.toks[b].idx + len(self.toks[b].text):t.head.idx]
                    if ';' in gap or (':' in gap and not any(q in gap for q in ('"', '“', '”'))):
                        self.semi_coord.add(t.i)
                        self.semi_punct[t.i] = ';' if ';' in gap else ':'
                    elif gap.lstrip().startswith(',') and t.dep_ == 'ccomp' and t.head.lemma_.lower() not in REPORT_VERBS | {
                            'think', 'believe', 'know', 'guess', 'suppose', 'hope', 'feel', 'imagine', 'admit', 'realize', 'realise', 'fear', 'bet', 'mean', 'see', 'wonder', 'thought'} \
                            and not any(q in txt[:t.head.idx] for q in ('"', '“')):
                        self.semi_coord.add(t.i)
                        self.semi_punct[t.i] = ','
                    elif any(q in gap for q in ('"', '”', '’')) or any(q in txt[max(0, self.toks[a].idx - 2):self.toks[a].idx + 1] for q in ('"', '“')):
                        self.quoted.add(t.i)
                elif a > t.head.i:
                    lead = txt[t.head.idx:self.toks[a].idx + 1]
                    if ':' in lead and ('"' in lead or '“' in lead):
                        self.quoted.add(t.i)
                    elif ('"' in lead or '“' in lead):
                        self.quoted.add(t.i)
        self.headset = set(t.i for t in self.heads)
        self.clause_of = {t.i: self._clause_of(t) for t in self.toks}
        self.clauses = []
        self._build()

    # ---------- predicate groups ----------
    def _find_semimodals(self):
        for t in self.toks:
            if t.dep_ != 'xcomp' or t.pos_ not in VERBAL:
                continue
            h = t.head
            has_to = any(c.dep_ == 'aux' and c.lower_ == 'to' for c in t.children)
            if not has_to:
                continue
            hl = h.lemma_.lower()
            auxl = [c.lemma_.lower() for c in h.children if c.dep_ in ('aux', 'auxpass')]
            if hl == 'go' and h.tag_ == 'VBG' and 'be' in auxl:
                self.merged[t.i] = 'going_to'
            elif hl == 'use' and h.lower_ == 'used' and h.tag_ in ('VBD', 'VBN') and 'be' not in auxl and 'get' not in auxl:
                self.merged[t.i] = 'used_to'
            elif hl == 'have' and h.tag_ in ('VB', 'VBZ', 'VBP', 'VBD', 'VBN', 'VBG') and not any(c.dep_ in OBJ for c in h.children):
                self.merged[t.i] = 'have_to'
            elif hl == 'ought':
                self.merged[t.i] = 'ought_to'
            elif h.lower_ == 'able' and h.head.lemma_ == 'be':
                pass
            elif hl == 'suppose' and h.tag_ == 'VBN' and 'be' in auxl:
                self.merged[t.i] = 'supposed_to'

    def _is_clause_head(self, t):
        if t.i in self.merged:
            return False
        dep = t.dep_
        if dep == 'ROOT':
            return True
        if dep not in CLAUSE_DEPS:
            return False
        if t.pos_ not in VERBAL:
            # copula clauses headed by AUX are VERBAL; adjective/noun heads of xcomp are not clauses
            return False
        if dep == 'conj':
            # coordinated predicate: head must itself be a clause head (or merged into one)
            h = t.head
            return h.i in self.merged or self._is_clause_head(h)
        if dep in ('amod',):
            return False
        return True

    def _clause_of(self, t):
        x = t
        while True:
            if x.i in self.merged:
                x = x.head
                continue
            if x.i in self.headset:
                return x.i
            if x.head.i == x.i:
                return x.i
            x = x.head

    def pred_tokens(self, h):
        """verb group tokens for clause head h (indices)."""
        out = [h]
        heads = [h] + [self.toks[i] for i in self.merged if self._clause_of(self.toks[i]) == h.i]
        for hh in heads:
            if hh is not h:
                out.append(hh)
            for c in hh.children:
                if c.dep_ in ('aux', 'auxpass', 'neg', 'prt'):
                    out.append(c)
        # chain of merged xcomps (e.g. going -> to -> have -> to ...)
        return sorted(set(out), key=lambda x: x.i)

    def _top_dep(self, t, h):
        """the dependent of the predicate group (h or merged) on the path from t to h."""
        x = t
        while True:
            hd = x.head
            if hd.i == h.i or hd.i in self.merged:
                return x
            if hd.i == x.i:
                return x
            x = hd

    # ---------- build ----------
    def _role(self, t, h, pset, has_expl):
        if h.dep_ == 'ROOT' and h.pos_ not in VERBAL:
            return None
        if t.i in pset:
            return 'V'
        if t.dep_ == 'punct' or t.is_punct:
            return None
        d = self._top_dep(t, h)
        dep = d.dep_
        if dep in ('expl',):
            return 'Sg'
        if dep in SUBJ:
            return 'S'
        if dep in OBJ:
            return 'O'
        if dep in COMP:
            return 'S' if (has_expl and dep == 'attr') else 'C'
        if dep == 'xcomp':
            return 'C'
        if dep in ADV:
            return 'A'
        if dep in CONN:
            return 'K'
        if dep in INTJ:
            return 'I'
        if dep == 'aux' and d.lower_ == 'to':
            return 'V'
        if dep in ('ccomp',):
            return 'O'
        return None

    def amb_flag(self):
        AMB = {'put', 'cut', 'set', 'let', 'hit', 'cost', 'hurt', 'shut', 'read', 'spread', 'quit', 'bet', 'split',
               'upset', 'cast', 'burst', 'fit', 'rid', 'broadcast', 'forecast', 'thrust', 'shed', 'spit'}
        for c in self.clauses:
            h = c['h']
            pt = [self.toks[i] for i in sorted(c['pset'])]
            if c['tense'] in ('pa', 'ps') and len([x for x in pt if x.dep_ in ('aux', 'auxpass')]) == 0 and h.lower_ in AMB:
                subj = [x for x in h.children if x.dep_ in ('nsubj',)]
                third = subj and subj[0].lower_ in ('he', 'she', 'it') or (subj and subj[0].tag_ in ('NN', 'NNP') and subj[0].lower_ not in ('i', 'you', 'we', 'they'))
                if c['tense'] == 'pa' and third:
                    continue  # "she put" must be past
                c['amb'] = True

    def _build(self):
        doc = self.doc
        order = sorted(self.heads, key=lambda t: (min(x.i for x in t.subtree), t.i))
        idx = {t.i: n for n, t in enumerate(order)}
        for t in order:
            h = t
            pset = set(x.i for x in self.pred_tokens(h))
            has_expl = any(c.dep_ == 'expl' for c in h.children)
            toks = [x for x in self.toks if self.clause_of[x.i] == h.i]
            roles = []
            for x in toks:
                r = self._role(x, h, pset, has_expl)
                roles.append((x, r))
            # parent clause
            par = None
            if h.dep_ != 'ROOT':
                par = idx.get(self.clause_of[h.head.i])
            ctype, extra = self._ctype(h)
            tense, voice, finite = self._tense(h)
            # shared subject for coordinated predicates
            has_subj = any(r in ('S', 'Sg') for _, r in roles)
            span = self._span(h)
            if h.dep_ == 'conj' and not has_subj and tense in ('inf_bare', 'imp', 'nonfinite') and self.clauses:
                first = h.head
                while first.dep_ == 'conj' and first.head.i != first.i:
                    first = first.head
                fc = next((c for c in self.clauses if c['h'].i == first.i), None)
                if fc and fc['finite']:
                    tense, finite = fc['tense'], True
            self.clauses.append(dict(h=h, i=idx[h.i], par=par, type=ctype, extra=extra, tense=tense, voice=voice,
                                     finite=finite, roles=roles, has_subj=has_subj, span=span, pset=pset))

    def _span(self, h):
        sub = list(h.subtree)
        for i in self.merged:
            if self._clause_of(self.toks[i]) == h.i:
                sub += list(self.toks[i].subtree)
        a = min(x.i for x in sub); b = max(x.i for x in sub)
        # drop trailing/leading punctuation
        while b > a and self.toks[b].is_punct and self.toks[b].lower_ not in ('"', '”'):
            b -= 1
        while a < b and self.toks[a].is_punct:
            a += 1
        return a, b

    def conn_phrase(self, h):
        a, b = self._span(h)
        words = [self.toks[k].lower_ for k in range(a, min(b + 1, a + 4))]
        txt = ' '.join(words)
        for c, cat in ADV_CONN:
            if txt == c or txt.startswith(c + ' '):
                return c, cat
        return None, None

    def _ctype(self, h):
        dep = h.dep_
        if h.i in self.semi_coord:
            return 'coord', self.semi_punct.get(h.i, ';')
        if dep == 'ROOT':
            if h.pos_ not in VERBAL:
                return 'frag', None
            return 'main', None
        if dep == 'conj':
            # same type as the first conjunct
            first = h.head
            while first.dep_ == 'conj' and first.head.i != first.i:
                first = first.head
            if first.dep_ == 'ROOT' or first.dep_ == 'parataxis':
                cc = [c for c in h.head.children if c.dep_ == 'cc' and c.i < h.i]
                return 'coord', (cc[-1].text if cc else None)
            if first.i in self.headset:
                t, e = self._ctype(first)
                cc = [c for c in h.head.children if c.dep_ == 'cc' and c.i < h.i]
                return t, e
            return 'coord', None
        if dep == 'parataxis':
            return 'parataxis', None
        if dep == 'relcl':
            if any(c.dep_ == 'aux' and c.lower_ == 'to' for c in h.children) and not any(c.dep_ in SUBJ for c in h.children):
                return 'acl_to', h.head.text
            return 'rel', h.head.text
        if dep == 'acl':
            if h.tag_ in ('VBN', 'VBG') and not any(c.dep_ in SUBJ for c in h.children):
                return 'reduced_rel', h.head.text
            if any(c.dep_ == 'aux' and c.lower_ == 'to' for c in h.children):
                return 'acl_to', h.head.text
            return 'appos_clause', h.head.text
        if dep in ('ccomp', 'parataxis') and h.i in self.semi_coord:
            return 'coord', ';'
        if dep == 'ccomp' and h.i in self.quoted:
            return 'quote', h.head.text
        if dep in ('ccomp',):
            return 'noun', h.head.text
        if dep in ('csubj', 'csubjpass'):
            return 'noun_subj', None
        if dep == 'xcomp':
            return 'xcomp', h.head.text
        if dep == 'pcomp':
            return 'pcomp', h.head.text
        if dep == 'advcl':
            c, cat = self.conn_phrase(h)
            return 'adv', c
        return 'other', None

    def _tense(self, h):
        """returns (tense_key, passive?, finite?)"""
        pt = self.pred_tokens(h)
        aux = [x for x in pt if x.dep_ in ('aux', 'auxpass') and x is not h]
        passive = any(x.dep_ == 'auxpass' for x in pt) or any(c.dep_ == 'nsubjpass' for c in h.children)
        semi = [self.merged[x.i] for x in pt if x.i in self.merged]
        md = [x for x in aux if x.tag_ == 'MD']
        finite_tok = [x for x in pt if x.tag_ in FINITE_TAGS and x.dep_ not in ('neg', 'prt')]
        has_subj = any(c.dep_ in SUBJ for c in h.children)
        # main verb (last verbal token)
        verbs = [x for x in pt if x.dep_ not in ('neg', 'prt') and x.lower_ != 'to']
        main = verbs[-1] if verbs else h
        lem = [x.lemma_.lower() for x in pt]
        perfect = False
        for k, x in enumerate(pt):
            if x.lemma_.lower() == 'have' and x.dep_ in ('aux',) and any(y.tag_ == 'VBN' for y in pt[k + 1:]):
                perfect = True
        prog = main.tag_ == 'VBG' and any(x.lemma_.lower() == 'be' and x.dep_ == 'aux' for x in pt)
        if 'going_to' in semi:
            return 'going_to', passive, True
        if 'used_to' in semi:
            return 'used_to', passive, True
        if md:
            m = md[0].lower_
            if m in ('will', "'ll", 'wo', 'shall') and m != 'shall' or m in ("'ll",):
                base = 'f'
                if perfect and prog: return 'fpc', passive, True
                if perfect: return 'fp', passive, True
                if prog: return 'fc', passive, True
                return 'fs', passive, True
            key = 'm:' + {'wo': 'will', "'d": 'would', 'ca': 'can', 'sha': 'shall'}.get(m, m)
            if perfect:
                key = 'mp:' + key[2:]
            return key, passive, True
        if not finite_tok:
            # non-finite or imperative
            if h.dep_ in ('ROOT', 'conj', 'parataxis') and h.tag_ == 'VB' and not has_subj and \
                    not any(x.lower_ == 'to' for x in pt) and (h.dep_ != 'conj' or self._root_is_imp()):
                return 'imp', passive, True
            if any(x.lower_ == 'to' and x.dep_ == 'aux' for x in pt):
                return 'inf_to', passive, False
            if h.tag_ == 'VBG' or (passive and any(x.tag_ == 'VBG' for x in pt)):
                if perfect:
                    return 'ving_perf', passive, False
                return 'ving', passive, False
            if h.tag_ == 'VBN':
                return 'v3', True if h.dep_ in ('acl', 'advcl') else passive, False
            if h.tag_ == 'VB':
                return 'inf_bare', passive, False
            return 'nonfinite', passive, False
        f = finite_tok[0]
        # imperative with do/don't: "Do not wait"
        if f.lemma_.lower() == 'do' and not has_subj and h.dep_ in ('ROOT',) and h.tag_ == 'VB':
            return 'imp', passive, True
        past = f.tag_ == 'VBD'
        if 'have_to' in semi:
            return ('m:had_to' if past else 'm:have_to'), passive, True
        if 'supposed_to' in semi:
            return 'm:supposed_to', passive, True
        if 'ought_to' in semi:
            return 'm:ought', passive, True
        if past:
            if perfect and prog: return 'papc', passive, True
            if perfect: return 'pap', passive, True
            if prog: return 'pac', passive, True
            return 'pa', passive, True
        if perfect and prog: return 'ppc', passive, True
        if perfect: return 'pp', passive, True
        if prog: return 'pc', passive, True
        return 'ps', passive, True

    def _root_is_imp(self):
        r = [t for t in self.toks if t.dep_ == 'ROOT'][0]
        return r.tag_ == 'VB' and not any(c.dep_ in SUBJ for c in r.children) and not any(c.tag_ == 'MD' for c in r.children)

    # ---------- export ----------
    def char(self, i):
        return self.toks[i].idx

    def cend(self, i):
        t = self.toks[i]
        return t.idx + len(t.text)

    def tok_roles(self):
        tr = {}
        for c in self.clauses:
            for x, r in c['roles']:
                tr[x.i] = (r, c['i'])
        return tr

    def runs(self):
        """[[start,end,role,clauseIndex]] contiguous role runs (innermost clause)."""
        tr = self.tok_roles()
        out = []
        for t in self.toks:
            rr = tr.get(t.i)
            if not rr or rr[0] is None:
                continue
            a, b = t.idx, t.idx + len(t.text)
            if out and out[-1][2] == rr[0] and out[-1][3] == rr[1]:
                gap = self.doc.text[out[-1][1]:a]
                if re.fullmatch(r"[\s,\-'’;:—–]*", gap) and gap.count(',') + gap.count(';') <= 1:
                    out[-1][1] = b
                    continue
            out.append([a, b, rr[0], rr[1]])
        return out

    def role_text(self, c):
        """ordered list of (role, text) for the clause table; nested clauses replaced with [MĐn]."""
        h = c['h']
        groups = []
        vt = sorted(c['pset'])
        # build from direct dependents of predicate group in order
        deps = []
        preds = [self.toks[i] for i in vt]
        for p in preds:
            for ch in p.children:
                if ch.i in c['pset']:
                    continue
                deps.append(ch)
        deps.sort(key=lambda t: min(y.i for y in t.subtree))
        vtext = self._vtext(vt)
        vpos = min(vt)
        placed_v = False
        has_expl = any(ch.dep_ == 'expl' for ch in deps)
        for ch in deps:
            if not placed_v and min(y.i for y in ch.subtree) > vpos:
                groups.append(('V', vtext)); placed_v = True
            if ch.dep_ == 'punct':
                continue
            if ch.i in self.headset:
                # whole dependent is a clause
                n = self.clauses_by_head[ch.i]['i']
                d = self.clauses_by_head[ch.i]
                if ch.dep_ == 'conj' or ch.i in self.semi_coord:
                    continue
                role = {'ccomp': 'O', 'csubj': 'S', 'csubjpass': 'S', 'advcl': 'A', 'xcomp': 'O', 'parataxis': None}.get(ch.dep_)
                if ch.dep_ == 'xcomp' and ch.pos_ not in VERBAL:
                    role = 'C'
                if role:
                    groups.append((role, f'[MĐ{n + 1}]'))
                continue
            r = self._role(ch, h, c['pset'], has_expl)
            if r is None or r == 'V':
                continue
            if r == 'K':
                continue
            groups.append((r, self._sub_text(ch, c)))
        if not placed_v:
            groups.append(('V', vtext))
        return groups

    def _is_desc(self, d, c):
        p = d['par']
        while p is not None:
            if p == c['i']:
                return True
            p = self.clauses[p]['par']
        return False

    def _vtext(self, vt):
        groups = []
        for i in vt:
            if groups and i == groups[-1][-1] + 1:
                groups[-1].append(i)
            else:
                groups.append([i])
        parts = []
        for g in groups:
            a, b = self.toks[g[0]], self.toks[g[-1]]
            parts.append(self.doc.text[a.idx:b.idx + len(b.text)])
        return ' … '.join(parts)

    def _sub_text(self, ch, c):
        toks = sorted(ch.subtree, key=lambda t: t.i)
        nested = {}
        for t in toks:
            if t.i != ch.i and t.i in self.clauses_by_head:
                d = self.clauses_by_head[t.i]
                for y in t.subtree:
                    nested.setdefault(y.i, d['i'])
                for m in self.merged:
                    if self._clause_of(self.toks[m]) == t.i:
                        for y in self.toks[m].subtree:
                            nested.setdefault(y.i, d['i'])
        parts = []
        emitted = set()
        for t in toks:
            if t.i in nested:
                n = nested[t.i]
                if n not in emitted:
                    emitted.add(n)
                    parts.append(('M', f'[MĐ{n + 1}]'))
                continue
            parts.append(('T', t))
        s = ''
        prev = None
        for kind, v in parts:
            if kind == 'M':
                s += (' ' if s else '') + v
                prev = None
                continue
            if prev is not None and prev.i + 1 == v.i:
                s += self.doc.text[prev.idx + len(prev.text):v.idx] + v.text
            else:
                s += (' ' if s else '') + v.text
            prev = v
        s = re.sub(r'\s+([,.;:!?])', r'\1', s)
        s = re.sub(r'\s+', ' ', s).strip(' ,;:—')
        return s

    def finalize(self):
        self.clauses_by_head = {c['h'].i: c for c in self.clauses}
        return self


def sentence_type(clauses):
    mains = [c for c in clauses if c['type'] in ('main', 'coord', 'parataxis') and c['finite']]
    subs = [c for c in clauses if c['type'] not in ('main', 'coord', 'parataxis', 'frag') and c['finite']]
    # coordinated predicates sharing a subject do not make a compound sentence
    m = len([c for c in mains if c['has_subj'] or c['tense'] == 'imp'])
    if m == 0 and mains:
        m = 1
    s = len(subs)
    if not mains and not subs:
        return 'frag'
    if m <= 1 and s == 0: return 'simple'
    if m >= 2 and s == 0: return 'compound'
    if m <= 1 and s >= 1: return 'complex'
    return 'cc'
