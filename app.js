const DATA = /*__DATA__*/null;
const P = DATA.paras, D = DATA.dict;
const LV = ['A1','A2','B1','B2','C1'];
const store = {
  get(k, d){ try{ const v = localStorage.getItem('ox5k_'+k); return v==null? d : JSON.parse(v);}catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem('ox5k_'+k, JSON.stringify(v)); }catch(e){} }
};
let learned = new Set(store.get('learned', []));
let cur = Math.min(Math.max(store.get('cur', 0),0), P.length-1);
let opts = Object.assign({trans:false, test:false, hl:true, filter:'all', lvTab:'all', intro:true, mode:'read', rate:0.92, dir:'en', size:20, gVi:false, gAll:false, gHard:false, tyStrict:false, tyMean:true, tyHl:true, tyRange:'30', tyMore:false}, store.get('opts', {}));
const firstPara = {}, WINFO = {};
P.forEach((p,i)=>p.w.forEach(w=>{ if(!(w.a in firstPara)){ firstPara[w.a]=i; WINFO[w.a]=Object.assign({pi:i}, w); } }));
const TOTAL = Object.keys(D).length;
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const isAdv = l => l==='B1'||l==='B2'||l==='C1';
const shuffle = a => { a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
let view = 'para';

function saveL(){ store.set('learned', [...learned]); }
function saveO(){ store.set('opts', opts); }

/* ---------- spaced repetition state ---------- */
const today = () => { const d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset()*60000) / 86400000); };
const INT = [1,3,7,21,60,150];
let srs = store.get('srs', {});
let revlog = store.get('revlog', {});
function saveS(){ store.set('srs', srs); }
(function migrate(){
  let ch = false; const t = today();
  learned.forEach(a=>{ if(D[a] && !srs[a]){ srs[a] = {i:0, d:t, r:0, l:0}; ch = true; } });
  Object.keys(srs).forEach(a=>{ if(!D[a] || !learned.has(a)){ delete srs[a]; ch = true; } });
  Object.keys(revlog).forEach(k=>{ if(+k < t-90){ delete revlog[k]; } });
  if(ch) saveS();
})();
function addLearn(a){ learned.add(a); if(!srs[a]) srs[a] = {i:0, d:today()+1, r:0, l:0}; }
function delLearn(a){ learned.delete(a); delete srs[a]; }
function commitLearn(){ saveL(); saveS(); updateProgress(); updateDue(); }
function dueList(){ const t = today(); return Object.keys(srs).filter(a=>srs[a].d<=t).sort((a,b)=>srs[a].d-srs[b].d || srs[a].i-srs[b].i); }
function updateDue(){ const n = dueList().length; const b = $('#revCount'); b.textContent = n>999 ? '999+' : n; b.classList.toggle('zero', n===0); }
const daysLabel = n => n<30 ? n+' ngày' : Math.round(n/30)+' tháng';

/* theme */
(function(){ const t = store.get('theme', null); if(t) document.documentElement.dataset.theme = t; })();
$('#themeBtn').onclick = () => {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme==='dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const t = dark ? 'light' : 'dark'; document.documentElement.dataset.theme = t; store.set('theme', t);
};

/* ---------- speech ---------- */
const HAS_TTS = 'speechSynthesis' in window;
let VOICE = null;
function pickVoice(){ try{ const vs = speechSynthesis.getVoices(); VOICE = vs.find(v=>/^en(-|_)GB/i.test(v.lang)) || vs.find(v=>/^en/i.test(v.lang)) || null; }catch(e){} }
if(HAS_TTS){ pickVoice(); try{ speechSynthesis.addEventListener('voiceschanged', pickVoice); }catch(e){} }
function utter(text, rate){ const u = new SpeechSynthesisUtterance(text); u.lang='en-GB'; u.rate = rate||0.92; if(!VOICE) pickVoice(); if(VOICE) u.voice = VOICE; return u; }
function speak(text, rate){ try{ if(!HAS_TTS) return; speechSynthesis.cancel(); speechSynthesis.speak(utter(text, rate)); }catch(e){} }
function speakSeq(list, rate){ try{ if(!HAS_TTS) return; speechSynthesis.cancel(); list.forEach(t=>speechSynthesis.speak(utter(t, rate))); }catch(e){} }
function stopSpeech(){ try{ if(HAS_TTS) speechSynthesis.cancel(); }catch(e){} }
const SPK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const PLAY = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>';

/* ---------- progress ---------- */
function updateProgress(){
  const n = learned.size;
  $('#pbar').style.width = (n/TOTAL*100).toFixed(2)+'%';
  $('#ptext').textContent = `Đã thuộc ${n.toLocaleString('vi-VN')} / ${TOTAL.toLocaleString('vi-VN')} từ`;
  $$('.item').forEach(el=>{
    const p = P[+el.dataset.i]; const d = p.w.filter(w=>learned.has(w.a)).length;
    el.querySelector('.mini i').style.width = (d/p.w.length*100)+'%';
  });
}

/* ---------- sidebar ---------- */
function buildSide(){
  const tabs = ['all',...LV];
  $('#lvtabs').innerHTML = tabs.map(t=>`<button class="lvtab ${opts.lvTab===t?'on':''}" data-t="${t}">${t==='all'?'Tất cả':t}</button>`).join('');
  let h=''; let last='';
  P.forEach((p,i)=>{
    if(opts.lvTab!=='all' && p.lv!==opts.lvTab) return;
    if(p.lv!==last){ const cnt=P.filter(x=>x.lv===p.lv).length; h+=`<div class="grp"><span>Cấp độ ${p.lv}</span><span>${cnt} đoạn</span></div>`; last=p.lv; }
    h+=`<div class="item ${i===cur&&view==='para'?'on':''}" data-i="${i}"><div class="num">${p.n}</div><div><div class="tt">${esc(p.t)}</div><div class="mini"><i></i></div></div></div>`;
  });
  $('#list').innerHTML = h;
  $$('.lvtab').forEach(b=>b.onclick=()=>{ opts.lvTab=b.dataset.t; saveO(); buildSide(); updateProgress(); });
  $$('.item').forEach(el=>el.onclick=()=>{ go(+el.dataset.i); closeSide(); });
}
function closeSide(){ $('#side').classList.remove('open'); $('#scrim').classList.remove('on'); }
$('#menuBtn').onclick=()=>{ $('#side').classList.add('open'); $('#scrim').classList.add('on'); };
$('#scrim').onclick=closeSide;

/* ---------- text comparison ---------- */
const nk = t => t.toLowerCase().replace(/[’‘`]/g,"'").replace(/^[^a-z0-9]+|[^a-z0-9]+$/g,'');
const toks = s => s.trim().split(/\s+/).filter(Boolean).map(t=>({t, k:nk(t)}));
function diff(user, orig, mask){
  const U = toks(user), O = toks(orig);
  const ui = U.map((x,i)=>i).filter(i=>U[i].k), oi = O.map((x,i)=>i).filter(i=>O[i].k);
  const n = ui.length, m = oi.length, W = m+1;
  const dp = new Uint16Array((n+1)*(m+1));
  for(let i=n-1;i>=0;i--) for(let j=m-1;j>=0;j--)
    dp[i*W+j] = U[ui[i]].k===O[oi[j]].k ? dp[(i+1)*W+j+1]+1 : Math.max(dp[(i+1)*W+j], dp[i*W+j+1]);
  const mu = new Set(), mo = new Set(); let i=0, j=0;
  while(i<n && j<m){
    if(U[ui[i]].k===O[oi[j]].k){ mu.add(ui[i]); mo.add(oi[j]); i++; j++; }
    else if(dp[(i+1)*W+j] >= dp[i*W+j+1]) i++; else j++;
  }
  const userHtml = U.map((x,i)=> !x.k||mu.has(i) ? esc(x.t) : `<s>${esc(x.t)}</s>`).join(' ');
  const origHtml = O.map((x,i)=> !x.k||mo.has(i) ? esc(x.t) : `<mark>${mask ? esc(x.t.replace(/[A-Za-z0-9]/g,'_')) : esc(x.t)}</mark>`).join(' ');
  return {score: m ? mo.size/m : 1, perfect: mo.size===m && n===m && m>0, userHtml, origHtml, empty: n===0};
}
function hintNext(user, orig){
  const U = toks(user).filter(x=>x.k), O = toks(orig), Ok = O.filter(x=>x.k);
  let ok = 0; while(ok<U.length && ok<Ok.length && U[ok].k===Ok[ok].k) ok++;
  const out = []; let c = 0;
  for(const x of O){ out.push(x.t); if(x.k){ c++; if(c>=ok+1) break; } }
  return out.join(' ') + (c<Ok.length ? ' ' : '');
}
function usedWord(a, text){
  const T = text.toLowerCase().replace(/[’‘]/g,"'").split(/[^a-z'\-]+/).filter(Boolean);
  const J = ' '+T.join(' ')+' ';
  const d = D[a], w = WINFO[a];
  const cands = d.w.toLowerCase().split(/,\s*|\s*\/\s*/).concat(w && w.form ? [w.form.toLowerCase()] : []).filter(Boolean);
  return cands.some(c=>{
    if(/\s/.test(c)){ const st = c.split(/\s+/); return J.includes(' '+st.join(' ')+' ') || (st.length>1 && T.some((t,i)=>t.startsWith(st[0].slice(0,Math.max(3,st[0].length-2))) && T[i+1]===st[1])); }
    const st = c.length>4 ? c.replace(/(e|y)$/,'') : c;
    return T.some(t => t===c || (c.length>3 && t.startsWith(st)));
  });
}
const scoreCls = (sc, kind) => sc==null ? '' : kind==='dict' ? (sc>=0.999?'good':sc>=0.7?'mid':'low') : (sc>=0.75?'good':sc>=0.45?'mid':'low');
function copyText(t){
  const fallback = () => { const ta=document.createElement('textarea'); ta.value=t; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); let ok=false; try{ ok=document.execCommand('copy'); }catch(e){} ta.remove(); return ok ? Promise.resolve() : Promise.reject(); };
  try{ if(navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t).catch(fallback); }catch(e){}
  return fallback();
}

/* ---------- paragraph view ---------- */
function vocabCard(w){
  const d = D[w.a]; const done = learned.has(w.a);
  const mean = opts.test && !done ? `<span class="hidden" data-reveal>${esc(d.m)}</span>` : esc(d.m);
  let x = '';
  if(isAdv(d.l)){
    if(d.c) x += `<div><span class="lab">Collocation</span><b>${esc(d.c)}</b></div>`;
    if(d.f) x += `<div><span class="lab">Word family</span>${esc(d.f)}</div>`;
  }
  if(w.ex) x += `<div class="ex">“${w.ex}”</div>`;
  const form = w.form && w.form.toLowerCase()!==d.w.toLowerCase() ? `<span class="vform">trong bài: <i>${esc(w.form)}</i></span>` : '';
  return `<div class="v ${done?'done':''}" data-a="${esc(w.a)}">
    <div class="vh"><span class="vw">${esc(d.w)}</span>${d.s?`<span class="vs">(${esc(d.s)})</span>`:''}<span class="vp">${esc(d.p)}</span><span class="badge ${d.l}">${d.l}</span>${form}</div>
    <div class="vact"><button class="spk" data-say="${esc(d.w)}" title="Nghe phát âm">${SPK}</button><button class="chk ${done?'on':''}" data-learn="${esc(w.a)}">${done?'✓ Đã thuộc':'Đánh dấu thuộc'}</button></div>
    <div class="vm">${mean}</div>
    ${x?`<div class="vx">${x}</div>`:''}
  </div>`;
}
function readBody(p){
  const total = p.w.length;
  const words = p.w.filter(w=> opts.filter==='all' || !learned.has(w.a));
  const lvCount = {}; p.w.forEach(w=>{ const l=D[w.a].l; lvCount[l]=(lvCount[l]||0)+1; });
  return `<div class="tools">
      <button class="tool ${opts.trans?'on':''}" id="tTrans">Bản dịch tiếng Việt</button>
      <button class="tool ${opts.test?'on':''}" id="tTest">Tự kiểm tra</button>
      <button class="tool ${opts.hl?'on':''}" id="tHl">Tô màu từ mới</button>
      <button class="tool" id="tRead">${SPK} Đọc to</button>
    </div>
    <div class="card text ${opts.hl?'':'nohl'}" id="text">${p.en}</div>
    <div class="legend">${LV.filter(l=>lvCount[l]).map(l=>`<span><i style="background:var(--${l}s);outline:1px solid var(--${l})"></i>${l}: ${lvCount[l]}</span>`).join('')}<span>· gạch chân = đã thuộc</span></div>
    <div class="card trans ${opts.trans?'on':''}" id="trans"><h3>Bản dịch</h3>${p.vi}</div>
    <section class="sec">
      <div class="sec-head"><h2>Từ vựng (${total})</h2>
        <div class="filters"><button class="chip ${opts.filter==='all'?'on':''}" data-f="all">Tất cả</button><button class="chip ${opts.filter==='todo'?'on':''}" data-f="todo">Chưa thuộc</button><button class="chip" id="markAll">Thuộc hết đoạn này</button></div>
      </div>
      <div class="vlist">${words.map(vocabCard).join('') || '<div class="g">🎉 Bạn đã thuộc hết từ của đoạn này.</div>'}</div>
    </section>
    ${gramPointsSection(p)}`;
}
function renderPara(){
  const p = P[cur]; const mode = opts.mode || 'read';
  const total = p.w.length, d = p.w.filter(w=>learned.has(w.a)).length;
  const intro = opts.intro && cur===0 && mode==='read' ? `<div class="card intro"><button class="close-intro" id="closeIntro">Ẩn ✕</button><h2>Cách học với file này</h2>
    <ul><li>Mỗi đoạn văn chứa một nhóm từ mới của Oxford 5000, được <b>tô màu theo cấp độ</b>. Tổng cộng 114 đoạn phủ đủ <b>4.982 mục từ</b> (A1 → C1).</li>
    <li>Bấm vào từ được tô màu để xem nghĩa, nghe phát âm và đánh dấu đã thuộc.</li>
    <li>Bật <b>Tự kiểm tra</b> để ẩn nghĩa trong danh sách từ; bấm vào ô xám để kiểm tra lại.</li>
    <li><b>Ngữ pháp</b>: cuối mỗi đoạn có 8–12 điểm ngữ pháp, bấm vào để tô sáng chỗ dùng trong bài. Tab <b>Phân tích câu</b> tách từng câu thành chủ ngữ, động từ, tân ngữ, mệnh đề và thì.</li>
    <li><b>Đọc hiểu</b>: 10 câu hỏi mỗi đoạn (5 trắc nghiệm, 4 True/False/Not Given, 1 câu hỏi mở). Nộp bài để xem điểm, giải thích và câu trích dẫn trong bài.</li>
    <li><b>Dịch ngược</b>: đọc từng câu tiếng Việt, tự dịch sang tiếng Anh rồi so với bản gốc. <b>Nghe chép</b>: nghe từng câu và gõ lại.</li>
    <li><b>Luyện gõ</b>: gõ lại cả đoạn văn để luyện gõ phím, đo WPM và độ chính xác; gõ xong một từ mới thì nghĩa của nó hiện ra ngay bên dưới.</li>
    <li><b>Ôn tập</b> (nút góc trên): từ bạn đánh dấu thuộc sẽ được hỏi lại theo lịch 1 → 3 → 7 → 21 → 60 → 150 ngày.</li>
    <li>Sau khi đọc, hãy thử tự viết một đoạn tương tự dùng 5–10 từ mới. Tiến độ được lưu tự động trên trình duyệt này.</li></ul></div>` : '';
  const modes = [['read','Đọc & học từ'],['rc','Đọc hiểu'],['gram','Phân tích câu'],['bt','Dịch ngược'],['dict','Nghe chép chính tả'],['type','Luyện gõ']];
  if(TY && TY.saveT && !TY.done) tySave(TY);
  const body = mode==='read' ? readBody(p) : mode==='gram' ? gramBody(p) : mode==='rc' ? rcBody(p) : mode==='type' ? typeBody(p) : practiceBody(p, mode);
  $('#reader').innerHTML = `${intro}
    <div class="meta"><span>Đoạn ${p.n} / ${P.length}</span><span class="badge ${p.lv}">${p.lv}</span><span>· ${p.wc} từ</span><span>· ${p.ss.length} câu</span><span>· ${total} từ mục tiêu</span><span>· đã thuộc ${d}/${total}</span>${rcMeta(p)}${tyMeta(p)}</div>
    <h1 class="title">${esc(p.t)}</h1>
    <p class="subtitle">${esc(p.tv)}</p>
    <div class="modes">${modes.map(([m,l])=>`<button data-m="${m}" class="${mode===m?'on':''}">${l}</button>`).join('')}</div>
    ${body}
    <div class="nav">
      <button class="nb" id="prev" ${cur===0?'disabled':''}><small>← Đoạn trước</small><span>${cur>0?esc(P[cur-1].t):''}</span></button>
      <button class="nb r" id="next" ${cur===P.length-1?'disabled':''}><small>Đoạn sau →</small><span>${cur<P.length-1?esc(P[cur+1].t):''}</span></button>
    </div>`;
  $$('.modes button').forEach(b=>b.onclick=()=>{ opts.mode=b.dataset.m; saveO(); stopSpeech(); renderPara(); });
  const pv=$('#prev'), nx=$('#next'); if(pv) pv.onclick=()=>go(cur-1); if(nx) nx.onclick=()=>go(cur+1);
  if(mode==='read'){ markLearnedInText(); bindRead(); } else if(mode==='gram') bindGram(p); else if(mode==='rc') bindRc(p); else if(mode==='type') bindType(p); else bindPractice(p, mode);
}
function markLearnedInText(){ $$('#text .w').forEach(el=>el.classList.toggle('learned', learned.has(el.dataset.a))); }
function bindRead(){
  const p = P[cur];
  const ci = $('#closeIntro'); if(ci) ci.onclick=()=>{ opts.intro=false; saveO(); renderPara(); };
  $('#tTrans').onclick=()=>{ opts.trans=!opts.trans; saveO(); $('#trans').classList.toggle('on',opts.trans); $('#tTrans').classList.toggle('on',opts.trans); };
  $('#tTest').onclick=()=>{ opts.test=!opts.test; saveO(); renderPara(); };
  $('#tHl').onclick=()=>{ opts.hl=!opts.hl; saveO(); $('#text').classList.toggle('nohl',!opts.hl); $('#tHl').classList.toggle('on',opts.hl); };
  $('#tRead').onclick=()=>{ try{ if(HAS_TTS && (speechSynthesis.speaking||speechSynthesis.pending)){ stopSpeech(); return; } }catch(e){} speakSeq(p.ss.map(x=>x[0])); };
  $$('.chip[data-f]').forEach(b=>b.onclick=()=>{ opts.filter=b.dataset.f; saveO(); renderPara(); });
  $('#markAll').onclick=()=>{ p.w.forEach(w=>addLearn(w.a)); commitLearn(); renderPara(); };
  $$('[data-reveal]').forEach(el=>el.onclick=()=>{ el.classList.remove('hidden'); el.removeAttribute('data-reveal'); });
  $$('[data-say]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); speak(b.dataset.say); });
  $$('[data-learn]').forEach(b=>b.onclick=()=>toggleLearn(b.dataset.learn));
  $$('#text .w').forEach(el=>el.onclick=e=>{ e.stopPropagation(); showPop(el); });
  bindGramCards(p);
}
function toggleLearn(a){
  if(learned.has(a)) delLearn(a); else addLearn(a);
  commitLearn();
  const y = window.scrollY; render(); window.scrollTo(0,y);
  hidePop();
}

/* ---------- practice: back-translation (bt) & dictation (dict) ---------- */
let PS = null;
function practiceState(kind, p){
  const key = (kind==='bt'?'bt_':'dc_') + p.n;
  const s = Object.assign({k:0, a:{}, sc:{}}, store.get(key, {}));
  if(s.k<0 || s.k>=p.ss.length) s.k = 0;
  s.key = key; return s;
}
function savePS(s){ const o = {k:s.k, a:s.a, sc:s.sc}; store.set(s.key, o); }
function practiceBody(p, kind){
  const s = PS = practiceState(kind, p); const N = p.ss.length, k = s.k; const [en, vi, al] = p.ss[k];
  const dotCls = i => kind==='bt' ? ((s.a[i]||'').trim() ? (s.sc[i]!=null?'done':'part') : '') : (s.sc[i]==null ? '' : s.sc[i]>=0.999 ? 'done' : 'part');
  const dots = p.ss.map((_,i)=>`<button class="dot ${dotCls(i)} ${i===k?'cur':''}" data-k="${i}" title="Câu ${i+1}">${i+1}</button>`).join('');
  const doneN = kind==='bt' ? p.ss.filter((_,i)=>(s.a[i]||'').trim() && s.sc[i]!=null).length : p.ss.filter((_,i)=>s.sc[i]>=0.999).length;
  const nav = `<span class="sp"></span><button class="btn ghost" id="pk" ${k===0?'disabled':''}>← Câu trước</button><button class="btn" id="nk">${k===N-1 ? (kind==='bt'?'Xem tổng kết ↓':'Hết đoạn ✓') : 'Câu sau →'}</button>`;
  if(kind==='bt'){
    return `<div class="card practice">
      <div class="prow"><span><b>Câu ${k+1}</b> / ${N} · đã so sánh ${doneN}/${N} câu</span><span><button class="chip" id="ctxBtn">Xem cả đoạn tiếng Việt</button> <button class="chip" id="resetP">Làm lại từ đầu</button></span></div>
      <div class="dots">${dots}</div>
      <div class="src">${esc(vi)}</div>
      ${al.length?`<div class="hints"><span>Từ vựng nên dùng:</span>${al.map(a=>`<span class="hint" data-h="${esc(a)}" title="${esc(D[a].m)}">${esc(D[a].w)}</span>`).join('')}</div>`:''}
      <textarea class="ans" id="ans" placeholder="Dịch câu trên sang tiếng Anh…" spellcheck="false">${esc(s.a[k]||'')}</textarea>
      <div class="acts"><button class="btn pri" id="chk">So sánh với bản gốc</button><span class="kbd">Enter · Shift+Enter để xuống dòng</span>${nav}</div>
      <div id="out"></div>
      <div class="ctx" id="ctx">${p.ss.map((x,i)=>`<span class="${i===k?'curs':''}">${esc(x[1])}</span>`).join(' ')}</div>
    </div>${btSummary(p, s)}`;
  }
  const rates = [[0.92,'Bình thường'],[0.75,'Chậm'],[0.6,'Rất chậm']];
  return `<div class="card practice">
    <div class="prow"><span><b>Câu ${k+1}</b> / ${N} · chép đúng ${doneN}/${N} câu</span><span>${rates.map(([r,l])=>`<button class="chip ${Math.abs(opts.rate-r)<0.01?'on':''}" data-r="${r}">${l}</button>`).join(' ')} <button class="chip" id="resetP">Làm lại từ đầu</button></span></div>
    <div class="dots">${dots}</div>
    <div class="playrow"><button class="play" id="play" title="Nghe (phím Ctrl)">${PLAY}</button><div class="note">${HAS_TTS ? 'Bấm ▶ hoặc nhấn riêng phím <b>Ctrl</b> để nghe lại. Gõ xong nhấn <b>Enter</b> để kiểm tra; đúng hết thì nhấn <b>Enter</b> lần nữa để sang câu sau.' : 'Trình duyệt này không hỗ trợ đọc to (Web Speech API). Hãy mở file bằng Chrome, Edge hoặc Safari.'}</div></div>
    <textarea class="ans" id="ans" placeholder="Gõ những gì bạn nghe được…" spellcheck="false" autocapitalize="off" autocomplete="off">${esc(s.a[k]||'')}</textarea>
    <div class="acts"><button class="btn pri" id="chk">Kiểm tra</button><button class="btn" id="hintB">Gợi ý 1 từ</button><button class="btn" id="showB">Hiện đáp án</button>${nav}</div>
    <div id="out"></div>
  </div>`;
}
function btSummary(p, s){
  const rows = p.ss.map((x,i)=>[x,i]).filter(([x,i])=>(s.a[i]||'').trim());
  if(!rows.length) return '';
  return `<div class="card summary" id="summary"><div class="sec-head"><h2>Tổng kết bản dịch</h2><small>${rows.length}/${p.ss.length} câu đã dịch</small></div>
    ${rows.map(([x,i])=>`<div class="sumrow"><span class="num">${i+1}</span><div><div class="note">${esc(x[1])}</div><div>${esc(s.a[i])}</div></div><span class="score ${scoreCls(s.sc[i],'bt')}">${s.sc[i]!=null?Math.round(s.sc[i]*100)+'%':'–'}</span></div>`).join('')}
    <div class="acts"><button class="btn pri" id="copyFix">Sao chép để nhờ Claude sửa</button><span class="note" id="copyMsg">Dán vào khung chat với Claude để được sửa lỗi và giải thích chi tiết.</span></div></div>`;
}
function bindPractice(p, kind){
  const s = PS, N = p.ss.length; const ta = $('#ans');
  let checked = false, perfect = false, ctrlSolo = false;
  const play = () => speak(p.ss[s.k][0], opts.rate);
  const goK = (k, autoplay) => {
    s.k = Math.max(0, Math.min(N-1, k)); savePS(s);
    const y = scrollY; renderPara(); scrollTo(0, y);
    const t = $('#ans'); if(t){ t.focus({preventScroll:true}); t.setSelectionRange(t.value.length, t.value.length); }
    if(kind==='dict' && autoplay) setTimeout(()=>speak(p.ss[s.k][0], opts.rate), 120);
  };
  const refreshDot = () => {
    const el = document.querySelector(`.dot[data-k="${s.k}"]`); if(!el) return;
    el.classList.remove('done','part');
    if(kind==='bt'){ if((s.a[s.k]||'').trim()) el.classList.add('done'); }
    else if(s.sc[s.k]!=null) el.classList.add(s.sc[s.k]>=0.999?'done':'part');
  };
  const check = () => {
    const [en, vi, al] = p.ss[s.k];
    const r = diff(ta.value, en, kind==='dict');
    if(r.empty){ $('#out').innerHTML = `<div class="res-box"><span class="note">Bạn chưa gõ gì.</span></div>`; return; }
    s.a[s.k] = ta.value;
    if(kind==='dict') s.sc[s.k] = Math.max(s.sc[s.k]||0, r.perfect ? 1 : Math.min(r.score, 0.99));
    else s.sc[s.k] = r.score;
    savePS(s); refreshDot();
    checked = true; perfect = r.perfect;
    const pct = Math.round(r.score*100);
    if(kind==='dict'){
      $('#out').innerHTML = r.perfect
        ? `<div class="res-box"><div><span class="score good">✓ Chính xác!</span><span class="note">${s.k<N-1?'Nhấn Enter để sang câu sau.':'Bạn đã tới câu cuối của đoạn.'}</span></div><div class="lbl">Nghĩa</div><div>${esc(vi)}</div></div>`
        : `<div class="res-box"><div><span class="score ${scoreCls(r.score,'dict')}">Đúng ${pct}% số từ</span><span class="note">Sửa lại rồi nhấn Enter để kiểm tra lại.</span></div>
           <div class="lbl">Câu gốc (ô vàng = từ còn thiếu hoặc sai)</div><div class="dline">${r.origHtml}</div>
           <div class="lbl">Bạn đã gõ (gạch đỏ = từ thừa hoặc sai)</div><div class="dline">${r.userHtml}</div></div>`;
    } else {
      $('#out').innerHTML = `<div class="res-box"><div><span class="score ${scoreCls(r.score,'bt')}">Khớp ${pct}% với bản gốc</span></div>
        <div class="lbl">Bản gốc (tô vàng = phần bạn diễn đạt khác)</div><div class="dline">${r.origHtml}</div>
        <div class="lbl">Bản của bạn</div><div class="dline">${r.userHtml}</div>
        <div class="note">Bản dịch khác bản gốc vẫn có thể đúng. Hãy để ý phần tô vàng: đó thường là collocation hoặc cấu trúc đáng học. Nhấn Enter để sang câu sau.</div></div>`;
      $$('.hint').forEach(h=>h.classList.toggle('used', usedWord(h.dataset.h, ta.value)));
    }
  };
  $$('.dot').forEach(b=>b.onclick=()=>goK(+b.dataset.k, true));
  $('#pk').onclick = () => goK(s.k-1, true);
  $('#nk').onclick = () => {
    if(s.k===N-1){ const el = $('#summary'); if(el) el.scrollIntoView({behavior:'smooth', block:'start'}); else if(kind==='dict' && cur<P.length-1) go(cur+1); return; }
    goK(s.k+1, true);
  };
  $('#chk').onclick = check;
  ta.addEventListener('input', ()=>{ checked = false; if(kind==='bt'){ s.a[s.k] = ta.value; savePS(s); } });
  ta.addEventListener('keydown', e=>{
    if(e.key==='Control'){ ctrlSolo = true; return; }
    ctrlSolo = false;
    if(e.key==='Enter' && !e.shiftKey && !e.isComposing){
      e.preventDefault();
      if(checked && (kind==='bt' || perfect)){ if(s.k<N-1) goK(s.k+1, true); else $('#nk').click(); }
      else check();
    }
  });
  const rs = $('#resetP');
  rs.onclick = () => {
    if(!rs.dataset.armed){ rs.dataset.armed='1'; rs.textContent='Bấm lần nữa để xoá'; setTimeout(()=>{ if(rs.isConnected){ delete rs.dataset.armed; rs.textContent='Làm lại từ đầu'; } }, 3000); return; }
    s.k = 0; s.a = {}; s.sc = {}; savePS(s); renderPara();
  };
  if(kind==='bt'){
    $('#ctxBtn').onclick = () => { const c = $('#ctx'); c.classList.toggle('on'); $('#ctxBtn').classList.toggle('on', c.classList.contains('on')); };
    const cf = $('#copyFix');
    if(cf) cf.onclick = () => {
      const rows = p.ss.map((x,i)=>[x,i]).filter(([x,i])=>(s.a[i]||'').trim());
      const txt = `Mình đang luyện dịch ngược (Việt → Anh) với đoạn văn "${p.t}" (cấp ${p.lv}). Hãy sửa bản dịch của mình: chỉ ra lỗi ngữ pháp, từ vựng, collocation và gợi ý cách diễn đạt tự nhiên hơn; giải thích ngắn gọn bằng tiếng Việt. Bản gốc chỉ để tham khảo — nếu bản của mình đúng nhưng khác bản gốc thì cứ nói là đúng.\n\n`
        + rows.map(([x,i])=>`${i+1}. VI: ${x[1]}\n   Bản của mình: ${s.a[i].trim()}\n   Bản gốc: ${x[0]}`).join('\n\n');
      copyText(txt).then(()=>{ $('#copyMsg').textContent = '✓ Đã sao chép. Dán vào khung chat với Claude để được sửa.'; })
                   .catch(()=>{ $('#copyMsg').textContent = 'Không sao chép được trên trình duyệt này.'; });
    };
  } else {
    $('#play').onclick = () => { play(); ta.focus({preventScroll:true}); };
    $$('.chip[data-r]').forEach(b=>b.onclick=()=>{ opts.rate = +b.dataset.r; saveO(); $$('.chip[data-r]').forEach(x=>x.classList.toggle('on', x===b)); play(); });
    ta.addEventListener('keyup', e=>{ if(e.key==='Control' && ctrlSolo){ play(); } ctrlSolo = false; });
    $('#hintB').onclick = () => { ta.value = hintNext(ta.value, p.ss[s.k][0]); checked = false; ta.focus(); };
    $('#showB').onclick = () => {
      const [en, vi] = p.ss[s.k];
      $('#out').innerHTML = `<div class="res-box"><div class="lbl">Đáp án</div><div class="dline">${esc(en)}</div><div class="lbl">Nghĩa</div><div>${esc(vi)}</div><div class="note">Hãy gõ lại câu này cho đúng rồi nhấn Enter để kiểm tra.</div></div>`;
      ta.focus();
    };
  }
}

/* ---------- typing practice (luyện gõ) ---------- */
// Ký tự đặc biệt trong bài có thể gõ bằng ký tự ASCII tương ứng.
const TY_ALT = {'—':'-', '–':'-', 'é':'e', '’':"'", '‘':"'", '“':'"', '”':'"'};
const tyEq = (typed, exp) => typed===exp || TY_ALT[exp]===typed;
const TY_GAP = 5000;              // khoảng nghỉ dài hơn 5 giây giữa hai phím chỉ tính 5 giây
let TY = null;                    // trạng thái lượt gõ đang mở
function tyWords(p){
  // Vị trí của các từ mục tiêu (span .w) trong chuỗi gõ = các câu ss nối bằng 1 dấu cách.
  const box = document.createElement('div'); box.innerHTML = p.en;
  const out = []; let base = 0;
  box.querySelectorAll('.sn').forEach(sn=>{
    const k = +sn.dataset.s; let off = 0;
    const walk = node => {
      for(const ch of node.childNodes){
        if(ch.nodeType===3){ off += ch.nodeValue.length; continue; }
        if(ch.classList && ch.classList.contains('w')){ const L = ch.textContent.length; out.push({s:base+off, e:base+off+L, a:ch.dataset.a, l:(D[ch.dataset.a]||{}).l}); off += L; }
        else walk(ch);
      }
    };
    walk(sn);
    base += p.ss[k][0].length + 1;
  });
  return out.filter(w=>D[w.a]);
}
function tyLoad(p){
  const text = p.ss.map(x=>x[0]).join(' ');
  const sv = store.get('ty_'+p.n, {});
  const cur = sv.cur && typeof sv.cur.t==='string' && sv.cur.t.length < text.length ? sv.cur : null;
  return { p, text, W: tyWords(p),
    t: cur ? cur.t : '', ms: cur ? cur.ms : 0, keys: cur ? cur.k : 0, errs: cur ? cur.e : 0,
    missed: new Set(cur ? cur.m : []), miss: cur ? (cur.x||{}) : {},
    best: sv.best || null, runs: sv.runs || 0, last: 0, done: null, imeWarn: false, saveT: null };
}
function tySave(s, finished){
  clearTimeout(s.saveT); s.saveT = null;
  const o = {best: s.best, runs: s.runs};
  if(!finished && s.t.length) o.cur = {t: s.t, ms: Math.round(s.ms), k: s.keys, e: s.errs, m: [...s.missed], x: s.miss};
  store.set('ty_'+s.p.n, o);
}
function tySaveSoon(s){ if(!s.saveT) s.saveT = setTimeout(()=>tySave(s), 600); }
function tyStats(s){
  let ok = 0; for(let i=0;i<s.t.length;i++) if(tyEq(s.t[i], s.text[i])) ok++;
  const min = s.ms/60000;
  return { wpm: min>0 ? ok/5/min : 0, acc: s.keys ? (s.keys-s.errs)/s.keys : 1, ok,
           wrongLeft: s.t.length-ok, pct: s.t.length/s.text.length };
}
const fmtTime = ms => { const t = Math.round(ms/1000); return Math.floor(t/60)+':'+String(t%60).padStart(2,'0'); };
function tyMeta(p){ const sv = store.get('ty_'+p.n, null); return sv && sv.best ? `<span>· gõ ${sv.best.w} WPM</span>` : ''; }
function typeBody(p){
  const s = TY = tyLoad(p);
  const chars = []; let word = '';
  for(let i=0;i<s.text.length;i++){
    word += `<span class="tc" data-i="${i}">${esc(s.text[i])}</span>`;
    if(s.text[i]===' ' || i===s.text.length-1){ chars.push(`<span class="tw">${word}</span>`); word=''; }
  }
  const best = s.best ? `Kỷ lục: <b>${s.best.w} WPM</b> · ${s.best.a}% · ${s.runs} lần` : 'Chưa có kỷ lục';
  return `<div class="card practice typing">
    <div class="prow"><span>${best}</span>
      <span class="tyopts">
        <span class="seg"><button class="chip ${opts.tyStrict?'':'on'}" data-ts="0" title="Gõ sai vẫn đi tiếp, dùng Backspace để sửa">Tự do</button><button class="chip ${opts.tyStrict?'on':''}" data-ts="1" title="Phải gõ đúng ký tự mới đi tiếp">Nghiêm ngặt</button></span>
        <button class="chip ${opts.tyMean?'on':''}" id="tyMeanB">Hiện nghĩa từ mới</button>
        <button class="chip ${opts.tyHl?'on':''}" id="tyHlB">Tô màu từ mới</button>
        <button class="chip" id="tyReset">Làm lại</button>
      </span></div>
    <div class="tystats">
      <div><b id="tyWpm">0</b><small>WPM</small></div>
      <div><b id="tyAcc">100%</b><small>Chính xác</small></div>
      <div><b id="tyTime">0:00</b><small>Thời gian</small></div>
      <div><b id="tyErr">0</b><small>Lỗi</small></div>
      <div class="typrog"><span class="trk"><i id="tyBar"></i></span><small id="tyPct">0%</small></div>
    </div>
    <div class="tywrap ${opts.tyHl?'hl':''}" id="tyWrap">
      <textarea id="tyIn" class="tyin" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Ô gõ"></textarea>
      <div class="tybox" id="tyBox"><div class="tytext ${opts.tyStrict?'strict':''}" id="tyText">${chars.join('')}</div></div>
      <div class="tyfocus" id="tyFocus"><span>Bấm vào đây hoặc nhấn phím bất kỳ để ${s.t.length?'gõ tiếp':'bắt đầu gõ'}</span></div>
    </div>
    <div class="tyime" id="tyIme">Hình như bộ gõ tiếng Việt (Unikey / EVKey) đang bật. Hãy chuyển sang chế độ gõ tiếng Anh (thường là <b>Ctrl+Shift</b> hoặc <b>Alt+Z</b>) rồi gõ tiếp.</div>
    <div class="kbd">Đồng hồ chạy từ phím đầu tiên; khoảng nghỉ dài hơn 5 giây chỉ tính 5 giây. <b>Esc</b> để tạm dừng. Dấu “—” gõ bằng “-”, chữ “é” gõ bằng “e”. Tiến độ được lưu tự động.</div>
    <div class="tynew ${opts.tyMean?'':'off'}" id="tyNew"></div>
    <div id="tyOut"></div>
  </div>
  <section class="sec tystat" id="tyStat"></section>`;
}
function bindType(p){
  const s = TY, text = s.text, N = text.length;
  const box = $('#tyBox'), wrap = $('#tyWrap'), inp = $('#tyIn'), tx = $('#tyText');
  const spans = tx.querySelectorAll('.tc');
  s.W.forEach(w=>{ for(let i=w.s;i<w.e;i++) spans[i].classList.add('nw', w.l||'A1'); });
  const shown = [];                          // các từ mới đã hiện nghĩa trong lượt này
  const paint = i => {
    const el = spans[i]; if(!el) return;
    el.classList.remove('ok','bad','cur','miss');
    if(i < s.t.length){ el.classList.add(tyEq(s.t[i], text[i]) ? 'ok' : 'bad'); if(s.missed.has(i) && tyEq(s.t[i], text[i])) el.classList.add('miss'); }
    else if(i===s.t.length) el.classList.add('cur');
  };
  for(let i=0;i<N;i++) paint(i);
  const scrollToCaret = () => {
    // giữ dòng đang gõ ở vị trí dòng thứ 2 của khung
    const el = spans[Math.min(s.t.length, N-1)]; if(!el) return;
    const cs = getComputedStyle(tx), lh = parseFloat(cs.lineHeight) || 40, pad = parseFloat(getComputedStyle(box).paddingTop) || 0;
    const line = Math.floor((el.offsetTop - pad + 2) / lh);
    const want = Math.max(0, line-1) * lh;
    if(Math.abs(box.scrollTop - want) > 2) box.scrollTo({top: want, behavior:'smooth'});
  };
  const stats = () => {
    const st = tyStats(s);
    $('#tyWpm').textContent = Math.round(st.wpm);
    $('#tyAcc').textContent = Math.round(st.acc*100)+'%';
    $('#tyTime').textContent = fmtTime(s.ms);
    $('#tyErr').textContent = s.errs;
    $('#tyBar').style.width = (st.pct*100).toFixed(1)+'%';
    $('#tyPct').textContent = Math.floor(st.pct*100)+'%';
  };
  const wordCard = w => { const d = D[w.a];
    return `<div class="tyw ${d.l}"><div class="tyh"><b>${esc(d.w)}</b>${d.s?`<span class="vs">(${esc(d.s)})</span>`:''}<span class="vp">${esc(d.p)}</span><span class="badge ${d.l}">${d.l}</span><button class="spk" data-say="${esc(d.w)}" title="Nghe">${SPK}</button></div><div class="tym">${esc(d.m)}</div></div>`; };
  const drawNew = () => {
    const el = $('#tyNew'); if(!el) return;
    if(!shown.length){ el.innerHTML = s.W.length ? `<div class="note">Đoạn này có <b>${s.W.length}</b> từ mới (gạch chân màu). Gõ xong từ nào, nghĩa của từ đó sẽ hiện ở đây.</div>` : ''; return; }
    const last = shown[shown.length-1], prev = shown.slice(-9,-1).reverse();
    el.innerHTML = `<div class="tynh"><span>Từ mới vừa gõ</span><small>${shown.length}/${s.W.length}</small></div>${wordCard(last)}`
      + (prev.length ? `<div class="typrev">${prev.map(w=>`<span class="hint" data-wi="${s.W.indexOf(w)}" title="${esc(D[w.a].m)}"><b>${esc(D[w.a].w)}</b> · ${esc(D[w.a].m.length>34?D[w.a].m.slice(0,32)+'…':D[w.a].m)}</span>`).join('')}</div>` : '');
    el.querySelectorAll('[data-say]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); speak(b.dataset.say); });
    el.querySelectorAll('[data-wi]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); const w = s.W[+b.dataset.wi]; const i = shown.indexOf(w); if(i>=0){ shown.splice(i,1); shown.push(w); drawNew(); } });
  };
  // từ đã gõ xong trước đó (khi gõ tiếp lượt cũ)
  s.W.forEach(w=>{ if(w.e <= s.t.length) shown.push(w); });
  let nextW = shown.length;
  drawNew(); stats();
  const checkWords = () => {
    let added = false;
    while(nextW < s.W.length && s.t.length >= s.W[nextW].e){
      const w = s.W[nextW++]; if(!shown.includes(w)){ shown.push(w); added = true; }
    }
    if(added && opts.tyMean) drawNew();
  };
  const tick = () => { const now = performance.now(); if(s.last) s.ms += Math.min(now - s.last, TY_GAP); s.last = now; };
  const finish = () => {
    tick(); const st = tyStats(s);
    const w = Math.round(st.wpm), a = Math.round(st.acc*100);
    s.runs++;
    const rec = !s.best || w > s.best.w;
    if(rec) s.best = {w, a, d: today()};
    // từ có lỗi
    const bad = new Map();
    s.missed.forEach(i=>{ let a0=i, b0=i; while(a0>0 && /[A-Za-z'é’-]/.test(text[a0-1])) a0--; while(b0<N && /[A-Za-z'é’-]/.test(text[b0])) b0++; if(b0>a0){ const wd = text.slice(a0,b0); bad.set(wd, (bad.get(wd)||0)+1); } });
    const hist = store.get('tyhist', []);
    hist.push({d: today(), t: Date.now(), n: p.n, w, a, ms: Math.round(s.ms), s: opts.tyStrict?1:0, k: s.keys, e: s.errs, c: N, x: s.miss, bw: [...bad.keys()].slice(0, 40)});
    store.set('tyhist', hist.slice(-1000));
    const badList = [...bad.keys()].slice(0, 40);
    const keyList = Object.entries(s.miss).sort((x,y)=>y[1]-x[1]).slice(0,8);
    tySave(s, true);
    $('#tyOut').innerHTML = `<div class="res-box tyres">
      <div class="tybig"><div><b>${w}</b><small>WPM</small></div><div><b>${a}%</b><small>Chính xác</small></div><div><b>${fmtTime(s.ms)}</b><small>Thời gian</small></div><div><b>${s.errs}</b><small>Lỗi</small></div></div>
      <div>${rec ? '<span class="score good">🏆 Kỷ lục mới của đoạn này!</span>' : `<span class="note">Kỷ lục của đoạn: ${s.best.w} WPM · ${s.best.a}%</span>`}${st.wrongLeft?` <span class="note">· còn ${st.wrongLeft} ký tự sai chưa sửa</span>`:''}</div>
      ${badList.length ? `<div class="lbl">Từ bạn đã gõ sai (${bad.size})</div><div class="typrev">${badList.map(x=>`<span class="hint">${esc(x)}</span>`).join('')}</div>` : '<div class="score good">Không sai ký tự nào. Tuyệt vời!</div>'}
      ${keyList.length ? `<div class="lbl">Ký tự hay gõ sai</div><div class="typrev">${keyList.map(([k,c])=>`<span class="hint"><b>${k===' '?'␣ dấu cách':esc(k)}</b> × ${c}</span>`).join('')}</div>` : ''}
      <div class="acts"><button class="btn pri" id="tyAgain">Gõ lại đoạn này</button>${cur<P.length-1?'<button class="btn" id="tyNext">Đoạn sau →</button>':''}<button class="btn ghost" id="tyRead">Xem từ vựng của đoạn</button></div>
    </div>`;
    $('#tyAgain').onclick = () => { TY = null; renderPara(); setTimeout(()=>{ const i=$('#tyIn'); if(i) i.focus({preventScroll:true}); }, 30); };
    const nx = $('#tyNext'); if(nx) nx.onclick = () => go(cur+1);
    $('#tyRead').onclick = () => { opts.mode='read'; saveO(); renderPara(); window.scrollTo({top:0}); };
    s.done = true; inp.blur(); wrap.classList.add('fin');
    $('#tyOut').scrollIntoView({behavior:'smooth', block:'nearest'});
    drawTyStats();
  };
  const typeChar = ch => {
    if(s.done) return;
    const i = s.t.length; if(i>=N) return;
    const exp = text[i];
    if(ch==='\n' || ch==='\r' || ch==='\t') return;
    if(ch.charCodeAt(0) > 127 && !tyEq(ch, exp) && !TY_ALT[ch]){ if(!s.imeWarn){ s.imeWarn = true; $('#tyIme').classList.add('on'); } return; }
    if(ch===' ') ch = ' ';
    tick(); s.keys++;
    const ok = tyEq(ch, exp);
    if(!ok){ s.errs++; s.missed.add(i); s.miss[exp] = (s.miss[exp]||0)+1; }
    if(opts.tyStrict && !ok){ const el = spans[i]; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); stats(); tySaveSoon(s); return; }
    s.t += ch; paint(i); paint(i+1);
    if(ok && s.imeWarn){ s.imeWarn = false; $('#tyIme').classList.remove('on'); }
    checkWords(); stats(); scrollToCaret(); tySaveSoon(s);
    if(s.t.length===N) finish();
  };
  const backspace = word => {
    if(s.done || opts.tyStrict || !s.t.length) return;
    let to = s.t.length-1;
    if(word){ while(to>0 && s.t[to-1]===' ') to--; while(to>0 && s.t[to-1]!==' ') to--; }
    const from = s.t.length; s.t = s.t.slice(0, to);
    for(let i=to;i<=from && i<N;i++) paint(i);
    stats(); scrollToCaret(); tySaveSoon(s);
  };
  let composing = false;
  inp.addEventListener('compositionstart', ()=>{ composing = true; });
  inp.addEventListener('compositionend', e=>{ composing = false; const d = e.data || inp.value; inp.value=''; for(const ch of d) typeChar(ch); });
  inp.addEventListener('beforeinput', e=>{
    if(composing || e.isComposing) return;
    const t = e.inputType;
    if(t==='insertText' || t==='insertReplacementText'){ e.preventDefault(); for(const ch of (e.data||'')) typeChar(ch); }
    else if(t==='deleteContentBackward'){ e.preventDefault(); backspace(false); }
    else if(t==='deleteWordBackward'){ e.preventDefault(); backspace(true); }
    else if(t==='insertLineBreak' || t==='insertParagraph' || t.startsWith('delete') || t.startsWith('history') || t==='insertFromPaste' || t==='insertFromDrop'){ e.preventDefault(); }
  });
  inp.addEventListener('input', ()=>{ if(composing) return; const v = inp.value; if(v){ inp.value=''; for(const ch of v) typeChar(ch); } });
  inp.addEventListener('keydown', e=>{
    if(e.key==='Escape'){ e.preventDefault(); inp.blur(); }
    else if(e.key==='Tab'){ e.preventDefault(); }
  });
  inp.addEventListener('focus', ()=>{ wrap.classList.add('focus'); s.last = 0; scrollToCaret(); });
  inp.addEventListener('blur', ()=>{ wrap.classList.remove('focus'); s.last = 0; if(s.t.length && !s.done) tySave(s); });
  wrap.addEventListener('mousedown', e=>{ if(s.done) return; if(e.target===box && e.offsetX >= box.clientWidth) return; e.preventDefault(); inp.focus({preventScroll:true}); });
  $$('[data-ts]').forEach(b=>b.onclick=()=>{ opts.tyStrict = b.dataset.ts==='1'; saveO(); $$('[data-ts]').forEach(x=>x.classList.toggle('on', x===b)); tx.classList.toggle('strict', opts.tyStrict); if(!s.done) inp.focus({preventScroll:true}); });
  $('#tyMeanB').onclick = () => { opts.tyMean = !opts.tyMean; saveO(); $('#tyMeanB').classList.toggle('on', opts.tyMean); $('#tyNew').classList.toggle('off', !opts.tyMean); drawNew(); };
  $('#tyHlB').onclick = () => { opts.tyHl = !opts.tyHl; saveO(); $('#tyHlB').classList.toggle('on', opts.tyHl); wrap.classList.toggle('hl', opts.tyHl); };
  const rs = $('#tyReset');
  rs.onclick = () => {
    if(s.t.length && !s.done && !rs.dataset.armed){ rs.dataset.armed='1'; rs.textContent='Bấm lần nữa để xoá lượt này'; setTimeout(()=>{ if(rs.isConnected){ delete rs.dataset.armed; rs.textContent='Làm lại'; } }, 3000); return; }
    s.t=''; s.ms=0; s.keys=0; s.errs=0; s.missed=new Set(); s.miss={}; tySave(s, true); TY=null; renderPara();
    setTimeout(()=>{ const i=$('#tyIn'); if(i) i.focus({preventScroll:true}); }, 30);
  };
  drawTyStats();
  // nhấn phím bất kỳ khi chưa focus thì bắt đầu gõ
  if(!s.done && matchMedia('(hover:hover)').matches) setTimeout(()=>{ if(inp.isConnected && !document.activeElement.closest('input,textarea')) inp.focus({preventScroll:true}); }, 0);
}

/* ---------- typing statistics (luyện gõ – giai đoạn 2) ---------- */
const TY_RANGES = [['7','7 ngày'],['30','30 ngày'],['all','Tất cả']];
const dayStr = d => { const x = new Date(d*86400000); return String(x.getUTCDate()).padStart(2,'0')+'/'+String(x.getUTCMonth()+1).padStart(2,'0'); };
const fmtN = n => Math.round(n).toLocaleString('vi-VN');
const fmtMin = ms => { const m = Math.round(ms/60000); return m < 60 ? m+' phút' : (m/60).toFixed(1).replace('.',',')+' giờ'; };
const KEY_MAP = {' ':'space','—':'-','–':'-','é':'e','’':"'",'‘':"'",'“':"'",'”':"'",'"':"'",'?':'/','!':'1',':':';','(':'9',')':'0'};
const keyOf = ch => /[a-z0-9]/.test(ch) ? ch : /[A-Z]/.test(ch) ? ch.toLowerCase() : (KEY_MAP[ch] || ch);
const KB_ROWS = [['1','2','3','4','5','6','7','8','9','0','-'],['q','w','e','r','t','y','u','i','o','p'],['a','s','d','f','g','h','j','k','l',';',"'"],['z','x','c','v','b','n','m',',','.','/']];
const KEY_LABEL = {"'":"' \"", ';':'; :', '/':'/ ?', '1':'1 !', '9':'9 (', '0':'0 )', '-':'- —'};
const PARA_KEYS = {};
function paraKeyCount(n){
  if(PARA_KEYS[n]) return PARA_KEYS[n];
  const p = P.find(x=>x.n===n); const c = {};
  if(p) for(const ch of p.ss.map(x=>x[0]).join(' ')){ const k = keyOf(ch); c[k] = (c[k]||0)+1; }
  return PARA_KEYS[n] = c;
}
const HEAD = (()=>{ const m = {}; for(const [a,d] of Object.entries(D)){ const k = d.w.toLowerCase(); if(!(k in m)) m[k] = a; } return m; })();
function niceTicks(lo, hi, n){
  const span = Math.max(hi-lo, 1e-9), raw = span/n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1,2,2.5,5,10].map(x=>x*mag).find(x=>x>=raw) || mag*10;
  const a = Math.floor(lo/step)*step, b = Math.ceil(hi/step)*step; const out = [];
  for(let v=a; v<=b+step*0.001; v+=step) out.push(+v.toFixed(6));
  return out;
}
// Biểu đồ SVG nhỏ: cột (bar) hoặc đường + chấm, có tooltip khi rê chuột / chạm.
function tyChart(host, cfg){
  if(!host) return;
  const W = Math.max(260, host.clientWidth || 600), H = cfg.h || 180;
  const ml = 38, mr = 12, mt = 12, mb = 24, iw = W-ml-mr, ih = H-mt-mb, n = cfg.n;
  const ticks = niceTicks(cfg.y[0], cfg.y[1], 4), y0 = ticks[0], y1 = ticks[ticks.length-1];
  const band = iw / Math.max(n,1), X = i => ml + band*(i+0.5), Y = v => mt + ih - (v-y0)/(y1-y0||1)*ih;
  let g = '';
  ticks.forEach(t=>{ g += `<line class="gl" x1="${ml}" x2="${W-mr}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ax" x="${ml-6}" y="${Y(t)+3.5}" text-anchor="end">${cfg.fmtY?cfg.fmtY(t):fmtN(t)}</text>`; });
  const lblEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw/58))));
  for(let i=0;i<n;i++) if(i%lblEvery===0 || (i===n-1 && (n-1)%lblEvery > lblEvery*0.6)) g += `<text class="ax" x="${X(i)}" y="${H-6}" text-anchor="middle">${esc(cfg.xl(i))}</text>`;
  let m = '';
  cfg.series.forEach(se=>{
    if(se.type==='bar'){
      const bw = Math.max(2, Math.min(24, band-2));
      se.v.forEach((v,i)=>{ if(!v) return; const x = X(i)-bw/2, top = Y(v), base = Y(y0), h = base-top, r = Math.min(4, h, bw/2);
        m += `<path class="bar" data-i="${i}" d="M${x},${base}V${top+r}Q${x},${top} ${x+r},${top}H${x+bw-r}Q${x+bw},${top} ${x+bw},${top+r}V${base}Z"/>`; });
    } else if(se.type==='line'){
      let d = ''; se.v.forEach((v,i)=>{ if(v==null) return; d += (d?'L':'M')+X(i).toFixed(1)+','+Y(v).toFixed(1); });
      if(d) m += `<path class="ln ${se.cls||''}" d="${d}"/>`;
      if(se.dots) se.v.forEach((v,i)=>{ if(v!=null) m += `<circle class="dt ${se.cls||''}" cx="${X(i)}" cy="${Y(v)}" r="4"/>`; });
    } else if(se.type==='dots'){
      se.v.forEach((v,i)=>{ if(v!=null) m += `<circle class="dt ${se.cls||''}" cx="${X(i)}" cy="${Y(v)}" r="4"/>`; });
    }
  });
  host.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cfg.label||'')}">${g}<line class="xh" id="" x1="0" x2="0" y1="${mt}" y2="${mt+ih}" style="display:none"/>${m}<rect class="hit" x="${ml}" y="${mt}" width="${iw}" height="${ih}"/></svg><div class="tytip"></div>`;
  const svg = host.querySelector('svg'), tip = host.querySelector('.tytip'), xh = svg.querySelector('.xh'), hit = svg.querySelector('.hit');
  const show = ev => {
    const r = svg.getBoundingClientRect(); const mx = ev.clientX - r.left; const i = Math.max(0, Math.min(n-1, Math.floor((mx-ml)/band)));
    if(n<=0) return;
    xh.setAttribute('x1', X(i)); xh.setAttribute('x2', X(i)); xh.style.display = '';
    svg.querySelectorAll('.bar').forEach(b=>b.classList.toggle('dim', +b.dataset.i!==i));
    tip.innerHTML = cfg.tip(i); tip.classList.add('on');
    const tw = tip.offsetWidth; let left = X(i) + 12; if(left + tw > W - 4) left = X(i) - tw - 12;
    tip.style.left = Math.max(0,left)+'px'; tip.style.top = mt+'px';
  };
  const hide = () => { xh.style.display='none'; tip.classList.remove('on'); svg.querySelectorAll('.bar').forEach(b=>b.classList.remove('dim')); };
  hit.addEventListener('pointermove', show); hit.addEventListener('pointerdown', show); hit.addEventListener('pointerleave', hide);
}
function tyHist(){ const h = store.get('tyhist', []); return Array.isArray(h) ? h.filter(r=>r && r.n && r.w!=null) : []; }
function drawTyStats(){
  const host = $('#tyStat'); if(!host) return;
  const all = tyHist(); const rg = opts.tyRange || '30'; const t0 = today();
  const days = rg==='all' ? null : +rg;
  const H = days ? all.filter(r=>r.d > t0-days) : all;
  const prev = days ? all.filter(r=>r.d > t0-2*days && r.d <= t0-days) : [];
  const head = `<div class="sec-head"><h2>Thống kê luyện gõ</h2><div class="filters">${TY_RANGES.map(([k,l])=>`<button class="chip ${rg===k?'on':''}" data-tr="${k}">${l}</button>`).join('')}</div></div>`;
  // bản đồ 114 đoạn (kỷ lục mọi thời gian)
  const bests = {}; P.forEach(p=>{ const sv = store.get('ty_'+p.n, null); if(sv && sv.best) bests[p.n] = sv.best.w; });
  const maxBest = Math.max(1, ...Object.values(bests));
  const doneN = Object.keys(bests).length;
  const mapHtml = `<div class="tysub"><h3>Các đoạn đã gõ <small>${doneN}/${P.length} đoạn · màu càng đậm, kỷ lục WPM càng cao</small></h3>
    <div class="tymap">${LV.map(l=>`<div class="tymrow"><span class="badge ${l}">${l}</span><div class="tymcells">${P.map((p,i)=>[p,i]).filter(([p])=>p.lv===l).map(([p,i])=>{ const b = bests[p.n];
      const kv = b!=null ? Math.round(18 + 62*b/maxBest) : 0, st = b!=null ? `style="--k:${kv}%"` : '';
      return `<button class="tymc ${b!=null?'has':''} ${kv>=50?'dk':''} ${i===cur?'cur':''}" data-pi="${i}" ${st} title="Đoạn ${p.n}: ${esc(p.t)}${b!=null?` · kỷ lục ${b} WPM`:' · chưa gõ'}">${p.n}</button>`; }).join('')}</div></div>`).join('')}</div></div>`;
  if(!all.length){
    host.innerHTML = head + `<div class="card tyempty"><div class="note">Chưa có lượt gõ nào. Gõ xong ít nhất một đoạn thì biểu đồ tốc độ, độ chính xác, phím hay gõ sai và từ hay gõ sai sẽ hiện ở đây.</div></div>` + `<div class="card tystatc">${mapHtml}</div>`;
    bindTyStats(host, []); return;
  }
  const sum = (arr, f) => arr.reduce((a,r)=>a+f(r), 0);
  const avgW = H.length ? sum(H, r=>r.w)/H.length : 0, avgA = H.length ? sum(H, r=>r.a)/H.length : 0;
  const pAvgW = prev.length ? sum(prev, r=>r.w)/prev.length : null;
  const best = H.length ? Math.max(...H.map(r=>r.w)) : 0;
  const delta = pAvgW!=null && H.length ? Math.round(avgW - pAvgW) : null;
  const dHtml = delta==null ? '' : delta===0 ? `<span class="tyd">= ${rg} ngày trước</span>` : `<span class="tyd ${delta>0?'up':'down'}">${delta>0?'▲':'▼'} ${Math.abs(delta)} so với ${rg} ngày trước</span>`;
  const tiles = `<div class="tytiles">
    <div><small>Số lượt gõ</small><b>${fmtN(H.length)}</b><span class="tyd">${new Set(H.map(r=>r.n)).size} đoạn khác nhau</span></div>
    <div><small>Thời gian luyện</small><b>${fmtMin(sum(H,r=>r.ms||0))}</b><span class="tyd">${new Set(H.map(r=>r.d)).size} ngày có luyện</span></div>
    <div><small>WPM trung bình</small><b>${H.length?Math.round(avgW):'–'}</b>${dHtml}</div>
    <div><small>Độ chính xác TB</small><b>${H.length?Math.round(avgA)+'%':'–'}</b><span class="tyd">cao nhất ${best} WPM</span></div>
  </div>`;
  if(!H.length){
    host.innerHTML = head + `<div class="card tystatc">${tiles}<div class="note">Không có lượt gõ nào trong ${rg} ngày qua. Chọn "Tất cả" để xem toàn bộ lịch sử.</div>${mapHtml}</div>`;
    bindTyStats(host, H); return;
  }
  // phím hay gõ sai: tỉ lệ = số lần sai / số lần xuất hiện trong các đoạn đã gõ
  const occ = {}, mis = {};
  H.forEach(r=>{ const c = paraKeyCount(r.n); for(const k in c) occ[k] = (occ[k]||0) + c[k]; for(const ch in (r.x||{})){ const k = keyOf(ch); mis[k] = (mis[k]||0) + r.x[ch]; } });
  // tỉ lệ = lần sai / (lần gõ đúng + lần sai) → luôn ≤ 100% kể cả khi một ký tự bị gõ sai nhiều lần liền
  const rate = k => occ[k] ? (mis[k]||0)/(occ[k] + (mis[k]||0)) : 0;
  const allKeys = [...KB_ROWS.flat(), 'space'];
  const maxRate = Math.max(1e-9, ...allKeys.map(rate));
  const keyCell = k => { const r = rate(k), o = occ[k]||0;
    const lvl = o && mis[k] ? Math.round(14 + 66*r/maxRate) : 0;
    return `<button class="tykey ${k==='space'?'sp':''} ${o?'':'na'} ${lvl>=50?'dk':''}" data-k="${esc(k)}" ${lvl?`style="--k:${lvl}%"`:''}><span>${k==='space'?'dấu cách':esc(KEY_LABEL[k]||k.toUpperCase())}</span>${o&&mis[k]?`<small>${(r*100).toFixed(r<0.01?1:0)}%</small>`:''}</button>`; };
  const worst = allKeys.filter(k=>mis[k] && occ[k]>=20).sort((a,b)=>rate(b)-rate(a)).slice(0,3);
  const keyInfo = k => `Phím <b>${k==='space'?'dấu cách':esc(KEY_LABEL[k]||k.toUpperCase())}</b>: sai ${fmtN(mis[k]||0)} lần, đúng ${fmtN(occ[k]||0)} lần (${((rate(k))*100).toFixed(1).replace('.',',')}%)`;
  const kbHtml = `<div class="tysub"><h3>Phím hay gõ sai <small>tỉ lệ sai = số lần gõ sai phím đó / tổng số lần gõ phím đó</small></h3>
    <div class="tykb">${KB_ROWS.map((row,ri)=>`<div class="tykr r${ri}">${row.map(keyCell).join('')}</div>`).join('')}<div class="tykr r4">${keyCell('space')}</div></div>
    <div class="tykscale"><span>Ít sai</span><i></i><span>Sai nhiều</span></div>
    <div class="note" id="tyKeyInfo">${worst.length ? 'Yếu nhất: ' + worst.map(k=>`<b>${k==='space'?'dấu cách':esc(KEY_LABEL[k]||k.toUpperCase())}</b> (${(rate(k)*100).toFixed(1).replace('.',',')}%)`).join(', ') + '. Rê chuột hoặc chạm vào một phím để xem chi tiết.' : 'Bạn chưa gõ sai phím nào trong khoảng thời gian này.'}</div></div>`;
  // từ hay gõ sai
  const bw = new Map(); H.forEach(r=>(r.bw||[]).forEach(w=>bw.set(w, (bw.get(w)||0)+1)));
  const bwList = [...bw.entries()].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0])).slice(0, 30);
  const bwHtml = `<div class="tysub"><h3>Từ hay gõ sai <small>${bw.size ? `${bw.size} từ · bấm để nghe` : ''}</small></h3>${bwList.length ? `<div class="typrev">${bwList.map(([w,c])=>{ const a = HEAD[w.toLowerCase()]; const d = a ? D[a] : null;
      return `<span class="hint tybw" data-say="${esc(w)}" title="${d?esc(d.m):''}"><b>${esc(w)}</b>${d?` · ${esc(d.m.length>28?d.m.slice(0,26)+'…':d.m)}`:''}${c>1?` <em>× ${c}</em>`:''}</span>`; }).join('')}</div>` : `<div class="note">${H.some(r=>r.bw) ? 'Không có từ nào bị gõ sai. Tuyệt vời!' : 'Danh sách này bắt đầu được ghi từ phiên bản có thống kê; hãy gõ thêm một đoạn.'}</div>`}</div>`;
  // lịch sử gần đây
  const recent = H.slice().reverse().slice(0, opts.tyMore ? 60 : 10);
  const histHtml = `<div class="tysub"><h3>Lịch sử gần đây</h3><div class="tytbl"><table><thead><tr><th>Ngày</th><th>Đoạn</th><th class="r">WPM</th><th class="r">Chính xác</th><th class="r">Thời gian</th><th>Kiểu</th></tr></thead><tbody>
    ${recent.map(r=>{ const pi = P.findIndex(p=>p.n===r.n); return `<tr><td>${dayStr(r.d)}</td><td><button class="lnk" data-pi="${pi}" title="${esc(P[pi]?P[pi].t:'')}">${r.n}. ${esc(P[pi]?(P[pi].t.length>26?P[pi].t.slice(0,24)+'…':P[pi].t):'')}</button></td><td class="r">${r.w}</td><td class="r">${r.a}%</td><td class="r">${fmtTime(r.ms||0)}</td><td>${r.s?'Nghiêm ngặt':'Tự do'}</td></tr>`; }).join('')}
    </tbody></table></div>
    <div class="acts">${H.length>10?`<button class="chip" id="tyMore">${opts.tyMore?'Thu gọn':'Xem thêm'}</button>`:''}<span class="sp"></span><button class="chip" id="tyClear">Xoá lịch sử luyện gõ</button></div></div>`;
  host.innerHTML = head + `<div class="card tystatc">${tiles}
    <div class="tysub"><h3>Tốc độ theo từng lượt <small>${H.length} lượt</small></h3>
      <div class="tylegend"><span><i class="lgd dot"></i>WPM từng lượt</span><span><i class="lgd line"></i>Trung bình 5 lượt gần nhất</span></div>
      <div class="tych" id="tyChW"></div></div>
    <div class="tysub"><h3>Độ chính xác theo từng lượt</h3><div class="tych" id="tyChA"></div></div>
    <div class="tysub"><h3>Thời gian luyện mỗi ngày</h3><div class="tych" id="tyChD"></div></div>
    ${kbHtml}${bwHtml}${mapHtml}${histHtml}</div>`;
  // vẽ biểu đồ
  const R = H.slice(-120); const nR = R.length;
  const pTitle = n => { const p = P.find(x=>x.n===n); return p ? p.t : ''; };
  const runTip = i => { const r = R[i]; return `<b>${dayStr(r.d)} · Đoạn ${r.n}</b><div>${esc(pTitle(r.n))}</div><div>${r.w} WPM · ${r.a}% · ${fmtTime(r.ms||0)}</div>${ma[i]!=null?`<div class="mut">TB 5 lượt: ${Math.round(ma[i])} WPM</div>`:''}`; };
  const ma = R.map((r,i)=>{ const s0 = R.slice(Math.max(0,i-4), i+1); return s0.reduce((a,x)=>a+x.w,0)/s0.length; });
  const xlRun = i => dayStr(R[i].d);
  tyChart($('#tyChW'), {n:nR, y:[0, Math.max(10, ...R.map(r=>r.w))], xl:xlRun, label:'WPM theo từng lượt', tip:runTip,
    series:[{type:'dots', v:R.map(r=>r.w), cls:'raw'}, {type:'line', v:ma, cls:'avg'}]});
  const minA = Math.min(...R.map(r=>r.a));
  tyChart($('#tyChA'), {n:nR, h:150, y:[Math.max(0, Math.min(90, minA-2)), 100], xl:xlRun, label:'Độ chính xác theo từng lượt', fmtY:v=>fmtN(v)+'%', tip:runTip,
    series:[{type:'line', v:R.map(r=>r.a), cls:'avg', dots:true}]});
  const firstD = Math.min(...H.map(r=>r.d)); const nD = days ? days : Math.min(90, t0-firstD+1);
  const dayList = Array.from({length:nD}, (_,i)=>t0-nD+1+i);
  const perDay = dayList.map(d=>{ const rs = H.filter(r=>r.d===d); return {ms: sum(rs, r=>r.ms||0), n: rs.length}; });
  tyChart($('#tyChD'), {n:nD, h:150, y:[0, Math.max(5, ...perDay.map(x=>x.ms/60000))], xl:i=>dayStr(dayList[i]), label:'Số phút luyện gõ mỗi ngày', fmtY:v=>fmtN(v)+'′',
    tip:i=>`<b>${dayStr(dayList[i])}</b><div>${perDay[i].n ? `${(perDay[i].ms/60000).toFixed(1).replace('.',',')} phút · ${perDay[i].n} lượt` : 'Không luyện'}</div>`,
    series:[{type:'bar', v:perDay.map(x=>x.ms/60000)}]});
  bindTyStats(host, H, keyInfo);
}
function bindTyStats(host, H, keyInfo){
  host.querySelectorAll('[data-tr]').forEach(b=>b.onclick=()=>{ opts.tyRange = b.dataset.tr; saveO(); drawTyStats(); });
  host.querySelectorAll('[data-pi]').forEach(b=>b.onclick=()=>{ const i = +b.dataset.pi; if(i>=0){ go(i); } });
  host.querySelectorAll('.tybw').forEach(b=>b.onclick=()=>speak(b.dataset.say));
  if(keyInfo) host.querySelectorAll('.tykey:not(.na)').forEach(b=>{ const f = ()=>{ $('#tyKeyInfo').innerHTML = keyInfo(b.dataset.k); }; b.onmouseenter = f; b.onclick = f; });
  const mo = $('#tyMore'); if(mo) mo.onclick = () => { opts.tyMore = !opts.tyMore; saveO(); drawTyStats(); };
  const cl = $('#tyClear');
  if(cl) cl.onclick = () => {
    if(!cl.dataset.armed){ cl.dataset.armed='1'; cl.textContent='Bấm lần nữa để xoá (không hoàn tác được)'; setTimeout(()=>{ if(cl.isConnected){ delete cl.dataset.armed; cl.textContent='Xoá lịch sử luyện gõ'; } }, 3500); return; }
    store.set('tyhist', []); P.forEach(p=>{ const sv = store.get('ty_'+p.n, null); if(sv){ delete sv.best; sv.runs = 0; store.set('ty_'+p.n, sv); } });
    TY = null; renderPara();
  };
}
let tyRsz = null;
addEventListener('resize', ()=>{ clearTimeout(tyRsz); tyRsz = setTimeout(()=>{ if(view==='para' && opts.mode==='type') drawTyStats(); }, 200); });

/* ---------- review (spaced repetition) ---------- */
let sess = null;
function startSess(free){
  const q = free ? shuffle(Object.keys(srs)).slice(0, 20) : shuffle(dueList().slice(0, opts.size));
  if(!q.length) return;
  sess = {q: q.map(a=>({a, again:0})), k:0, free, dir:opts.dir, revealed:false, typed:'', ok:null, sug:null, cnt:[0,0,0]};
  renderReview(); scrollTo(0,0);
}
function renderReview(){
  if(sess && sess.k < sess.q.length) return renderCard();
  if(sess) return renderDone();
  const t = today(); const keys = Object.keys(srs); const due = dueList().length;
  const strong = keys.filter(a=>srs[a].i>=3).length; const todayN = revlog[t]||0;
  const fc = [...Array(7)].map((_,d)=>keys.filter(a=> d===0 ? srs[a].d<=t : srs[a].d===t+d).length);
  const mx = Math.max(1, ...fc);
  const dn = d => d===0 ? 'Hôm nay' : d===1 ? 'Ngày mai' : ['CN','T2','T3','T4','T5','T6','T7'][new Date(Date.now()+d*864e5).getDay()];
  $('#reader').innerHTML = `
    <button class="btn ghost" id="back">← Quay lại đoạn văn</button>
    <h1 class="title">Ôn tập theo lịch</h1>
    <p class="subtitle">Từ bạn đánh dấu “đã thuộc” sẽ vào lịch ôn. Nhớ tốt thì khoảng cách giãn dần (1 → 3 → 7 → 21 → 60 → 150 ngày); quên thì quay lại từ đầu.</p>
    ${keys.length ? `
    <div class="stats">
      <div class="card stat"><b>${due}</b><span>Đến hạn hôm nay</span></div>
      <div class="card stat"><b>${keys.length}</b><span>Từ trong lịch ôn</span></div>
      <div class="card stat"><b>${strong}</b><span>Đã nhớ vững (≥ 21 ngày)</span></div>
      <div class="card stat"><b>${todayN}</b><span>Lượt ôn hôm nay</span></div>
    </div>
    <div class="card fc-wrap"><div>Số từ đến hạn 7 ngày tới</div><div class="fc">${fc.map((c,d)=>`<div><em>${c}</em><i style="height:${Math.round(c/mx*70)}%"></i>${dn(d)}</div>`).join('')}</div></div>
    <div class="card practice" style="margin-top:12px">
      <div class="opt-row"><span>Chiều ôn</span><button class="chip ${opts.dir==='en'?'on':''}" data-dir="en">Anh → Việt (lật thẻ)</button><button class="chip ${opts.dir==='vi'?'on':''}" data-dir="vi">Việt → Anh (gõ từ)</button></div>
      <div class="opt-row"><span>Số từ mỗi lượt</span>${[20,50,100].map(n=>`<button class="chip ${opts.size===n?'on':''}" data-size="${n}">${n}</button>`).join('')}</div>
      <div class="acts"><button class="btn pri" id="start" ${due?'':'disabled'}>${due ? `Bắt đầu ôn ${Math.min(due, opts.size)} từ` : 'Hôm nay không còn từ đến hạn 🎉'}</button><button class="btn" id="free">Ôn tự do 20 từ ngẫu nhiên</button><span class="note">Ôn tự do không làm thay đổi lịch.</span></div>
    </div>` : `<div class="card practice"><p style="margin:0 0 6px"><b>Chưa có từ nào trong lịch ôn.</b></p><p class="note" style="margin:0">Mở một đoạn văn và bấm “Đánh dấu thuộc” ở những từ bạn đã học (hoặc “Thuộc hết đoạn này”). Từ ngày hôm sau, các từ đó sẽ xuất hiện ở đây để ôn.</p></div>`}`;
  $('#back').onclick = () => go(cur);
  $$('[data-dir]').forEach(b=>b.onclick=()=>{ opts.dir=b.dataset.dir; saveO(); renderReview(); });
  $$('[data-size]').forEach(b=>b.onclick=()=>{ opts.size=+b.dataset.size; saveO(); renderReview(); });
  const st = $('#start'); if(st) st.onclick = () => startSess(false);
  const fr = $('#free'); if(fr) fr.onclick = () => startSess(true);
}
function renderCard(){
  const it = sess.q[sess.k]; const a = it.a, d = D[a], w = WINFO[a] || {}, s = srs[a] || {i:0};
  const N = sess.q.length; const vi = sess.dir==='vi';
  const exFront = w.ex ? w.ex.replace(/<b>[\s\S]*?<\/b>/, '<span class="blank"></span>') : '';
  const head = `<div class="fmeta"><span>${esc(d.p)}</span><span class="badge ${d.l}">${d.l}</span>${it.again?'<span>· ôn lại</span>':''}</div>`;
  let front;
  if(!vi) front = `<div class="fw">${esc(d.w)}</div><div class="fmeta">${d.s?`<span class="vs">(${esc(d.s)})</span>`:''}<span>${esc(d.p)}</span><span class="badge ${d.l}">${d.l}</span><button class="spk" id="say" title="Nghe phát âm">${SPK}</button></div>`;
  else front = `${head}<div class="fmean">${maskWord(d.m, d.w, w.form)}</div>${exFront?`<div class="fex">“${exFront}”</div>`:''}
      <input class="type-in ${sess.revealed?(sess.ok?'ok':'no'):''}" id="typed" placeholder="Gõ từ tiếng Anh…" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(sess.typed)}" ${sess.revealed?'disabled':''}>
      ${sess.hint && !sess.revealed ? `<div class="note">Gợi ý: ${esc(sess.hint)}</div>` : ''}`;
  let back = '';
  if(sess.revealed){
    let x = '';
    if(isAdv(d.l)){ if(d.c) x += `<div><b>Collocation:</b> ${esc(d.c)}</div>`; if(d.f) x += `<div><b>Word family:</b> ${esc(d.f)}</div>`; }
    back = `<hr>${vi ? `<div class="fw">${esc(d.w)}</div><div class="fmeta">${d.s?`<span class="vs">(${esc(d.s)})</span>`:''}<button class="spk" id="say" title="Nghe phát âm">${SPK}</button>${sess.ok?'<span style="color:var(--good);font-weight:700">✓ Đúng</span>':'<span style="color:var(--bad);font-weight:700">✗ Chưa đúng</span>'}</div>` : `<div class="fmean">${esc(d.m)}</div>`}
      ${x?`<div class="fx">${x}</div>`:''}
      ${w.ex && !vi ? `<div class="fex">“${w.ex}”</div>` : ''}${w.ex && vi ? `<div class="fex">“${w.ex}”</div>` : ''}
      ${w.pi!=null ? `<div class="note">Học ở đoạn ${P[w.pi].n}: <a href="#" id="toPara">${esc(P[w.pi].t)}</a></div>` : ''}`;
  }
  const nextInt = g => g===0 ? 1 : INT[Math.min(s.i+g, INT.length-1)];
  const noSched = sess.free || it.again;
  const ctl = sess.revealed
    ? `<div class="grades">${['Quên','Nhớ','Dễ'].map((l,g)=>`<button class="grade g${g} ${sess.sug===g?'sug':''}" data-g="${g}">${l}<small>${noSched?'không đổi lịch':'ôn lại sau '+daysLabel(nextInt(g))} · phím ${g+1}</small></button>`).join('')}</div>`
    : `<div class="acts" style="justify-content:center">${vi ? `<button class="btn" id="hintW">Gợi ý chữ cái đầu</button><button class="btn pri" id="checkW">Kiểm tra</button><span class="kbd">Enter</span>` : `<button class="btn pri" id="reveal">Hiện nghĩa</button><span class="kbd">Space / Enter</span>`}</div>`;
  $('#reader').innerHTML = `<div class="prow"><button class="btn ghost" id="quit">← Dừng ôn</button><span><b>${sess.k+1}</b> / ${N}${sess.free?' · ôn tự do':''}</span></div>
    <div class="sbar"><i style="width:${(sess.k/N*100).toFixed(1)}%"></i></div>
    <div class="card flash-card">${front}${back}</div>${ctl}`;
  $('#quit').onclick = () => { sess = null; renderReview(); };
  const say = $('#say'); if(say) say.onclick = () => speak(d.w);
  const tp = $('#toPara'); if(tp) tp.onclick = e => { e.preventDefault(); sess = null; go(w.pi, a); };
  const rv = $('#reveal'); if(rv) rv.onclick = reveal;
  const cw = $('#checkW'); if(cw) cw.onclick = checkTyped;
  const hw = $('#hintW'); if(hw) hw.onclick = () => { const wd = d.w.split(/,\s*/)[0]; sess.hint = wd[0] + wd.slice(1).replace(/[A-Za-z]/g,'_ ').trim() + `  (${wd.replace(/[^A-Za-z]/g,'').length} chữ cái)`; sess.typed = $('#typed').value; renderCard(); $('#typed').focus(); };
  $$('.grade').forEach(b=>b.onclick=()=>doGrade(+b.dataset.g));
  const ti = $('#typed');
  if(ti && !sess.revealed){
    ti.focus({preventScroll:true}); ti.setSelectionRange(ti.value.length, ti.value.length);
    ti.addEventListener('keydown', e=>{ if(e.key==='Enter' && !e.isComposing){ e.preventDefault(); e.stopPropagation(); checkTyped(); } });
  }
}
function maskWord(text, word, form){
  let h = esc(text);
  const cands = word.split(/,\s*|\s*\/\s*/).concat(form ? [form] : []).filter(c=>c && c.length>1).sort((a,b)=>b.length-a.length);
  cands.forEach(c=>{ const re = new RegExp('(^|[^A-Za-z])(' + esc(c).replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')(?![A-Za-z])', 'gi'); h = h.replace(re, '$1___'); });
  return h;
}
function reveal(){ sess.revealed = true; sess.sug = 1; renderCard(); }
function checkTyped(){
  const d = D[sess.q[sess.k].a], w = WINFO[sess.q[sess.k].a] || {};
  const raw = $('#typed').value; const v = raw.trim().toLowerCase().replace(/[’]/g,"'").replace(/\s+/g,' ');
  const cands = d.w.toLowerCase().split(/,\s*|\s*\/\s*/).concat(w.form ? [w.form.toLowerCase()] : []);
  sess.typed = raw; sess.ok = !!v && cands.includes(v); sess.sug = sess.ok ? 1 : 0; sess.revealed = true;
  renderCard(); speak(d.w);
}
function doGrade(g){
  const it = sess.q[sess.k]; const a = it.a; const t = today();
  if(!sess.free && !it.again && srs[a]){
    const s = srs[a];
    if(g===0){ s.i = 0; s.d = t+1; s.l = (s.l||0)+1; }
    else { s.i = Math.min(s.i+g, INT.length-1); s.d = t + INT[s.i]; }
    s.r = (s.r||0)+1; saveS();
  }
  if(g===0 && it.again<2) sess.q.push({a, again: it.again+1});
  if(!it.again) sess.cnt[g]++;
  revlog[t] = (revlog[t]||0)+1; store.set('revlog', revlog);
  sess.k++; sess.revealed = false; sess.typed = ''; sess.ok = null; sess.sug = null; sess.hint = null;
  updateDue(); renderReview();
}
function renderDone(){
  const [c0,c1,c2] = sess.cnt; const free = sess.free;
  $('#reader').innerHTML = `<h1 class="title">Xong lượt ôn!</h1>
    <p class="subtitle">${free ? 'Lượt ôn tự do không làm thay đổi lịch.' : 'Lịch ôn đã được cập nhật.'}</p>
    <div class="stats"><div class="card stat"><b style="color:var(--bad)">${c0}</b><span>Quên</span></div><div class="card stat"><b style="color:var(--accent)">${c1}</b><span>Nhớ</span></div><div class="card stat"><b style="color:var(--good)">${c2}</b><span>Dễ</span></div><div class="card stat"><b>${dueList().length}</b><span>Còn đến hạn hôm nay</span></div></div>
    ${c0 ? `<p class="note">Những từ bạn quên sẽ quay lại vào ngày mai. Mẹo: mở lại đoạn văn chứa từ đó và đọc lại cả câu để nhớ theo ngữ cảnh.</p>` : ''}
    <div class="acts"><button class="btn pri" id="again">Về trang ôn tập</button><button class="btn" id="back">Quay lại đoạn văn</button></div>`;
  $('#again').onclick = () => { sess = null; renderReview(); };
  $('#back').onclick = () => { sess = null; go(cur); };
}


/* ---------- grammar ---------- */
const GC = DATA.gcat || {};
let gSel = -1, gOpen = new Set();
const ROLE_VI = {S:'Chủ ngữ', Sg:'Chủ ngữ giả', V:'Động từ', O:'Tân ngữ', C:'Bổ ngữ', A:'Trạng ngữ', K:'Liên từ', I:'Thán từ', L:'Người nói'};
const ROLE_SHORT = {S:'S', Sg:'S', V:'V', O:'O', C:'C', A:'A', K:'K', I:'!', L:''};
const STYPE = {simple:'Câu đơn', compound:'Câu ghép', complex:'Câu phức', cc:'Câu ghép phức', frag:'Câu rút gọn'};
const TNAME = {ps:'Hiện tại đơn', pc:'Hiện tại tiếp diễn', pp:'Hiện tại hoàn thành', ppc:'HT hoàn thành tiếp diễn',
  pa:'Quá khứ đơn', pac:'Quá khứ tiếp diễn', pap:'Quá khứ hoàn thành', papc:'QK hoàn thành tiếp diễn',
  fs:'Tương lai đơn', fc:'Tương lai tiếp diễn', fp:'Tương lai hoàn thành', fpc:'TL hoàn thành tiếp diễn',
  going_to:'be going to + V', used_to:'used to + V', imp:'Mệnh lệnh', inf_to:'to-V (không chia thì)', inf_bare:'V nguyên mẫu',
  ving:'V-ing (không chia thì)', ving_perf:'having + V3', v3:'V3 (phân từ quá khứ)'};
const ADVL = {time:'chỉ thời gian', reason:'chỉ lý do', conc:'chỉ sự nhượng bộ / tương phản', cond:'chỉ điều kiện', purp:'chỉ mục đích',
  manner:'chỉ cách thức', place:'chỉ nơi chốn', comp:'so sánh', result:'chỉ kết quả', as:'với “as”', red:'rút gọn (liên từ + V-ing/V3)', part:'dạng phân từ (rút gọn)'};
function tenseLabel(t){
  if(!t) return '';
  if(TNAME[t]) return TNAME[t];
  const sp = {have_to:'have to + V', had_to:'had to + V', supposed_to:'be supposed to + V', ought:'ought to + V'};
  if(t.startsWith('mp:')) return (t.slice(3)==='ought'?'ought to':t.slice(3)) + ' have + V3';
  if(t.startsWith('m:')){ const m = t.slice(2); return sp[m] || (m + ' + V'); }
  return '';
}
function clauseLabel(c){
  const [ty, ex, cat, t, pas, fin, par, prole, roles, hs] = c;
  const q = x => `“${esc(x)}”`;
  switch(ty){
    case 'main': return 'Mệnh đề chính';
    case 'frag': return 'Cụm từ (không có động từ chính)';
    case 'coord':
      if([';', ':', ','].includes(ex)) return `Mệnh đề chính (ngăn bằng dấu ${ex===';'?'chấm phẩy':ex===':'?'hai chấm':'phẩy'})`;
      if(!hs && fin) return `Vị ngữ nối tiếp, dùng chung chủ ngữ${ex?` (nối bằng ${q(ex)})`:''}`;
      return `Mệnh đề chính${ex?` nối bằng ${q(ex)}`:' song song'}`;
    case 'parataxis': return 'Mệnh đề chen / giải thích';
    case 'rel': return `Mệnh đề quan hệ, bổ nghĩa cho ${q(ex)}`;
    case 'reduced_rel': return `Mệnh đề quan hệ rút gọn, bổ nghĩa cho ${q(ex)}`;
    case 'acl_to': return `Cụm to-V bổ nghĩa cho ${q(ex)}`;
    case 'appos_clause': return `Mệnh đề bổ sung cho ${q(ex)}`;
    case 'noun': return `Mệnh đề danh từ, làm tân ngữ cho ${q(ex)}`;
    case 'quote': return `Lời nói trực tiếp (sau ${q(ex)})`;
    case 'noun_subj': return 'Mệnh đề danh từ làm chủ ngữ';
    case 'xcomp': return `Cụm động từ không chia thì, sau ${q(ex)}`;
    case 'pcomp': return `Cụm V-ing sau giới từ ${q(ex)}`;
    case 'adv':
      if(!fin && cat==='purp') return 'Cụm to-V chỉ mục đích';
      return `Mệnh đề trạng ngữ ${ADVL[cat]||''}${ex?` (${q(ex)})`:''}`;
    default: return 'Mệnh đề phụ';
  }
}
const isMainType = ty => ty==='main' || ty==='coord' || ty==='frag' || ty==='parataxis';
function pointInfo(pt){
  if(pt.h) return {name: pt.h[0], form: '', expl: pt.h[1], lv: '', hand: true};
  const c = GC[pt.k] || [pt.k, '', '', ''];
  return {name: c[0], form: c[1], expl: c[2], lv: c[3], hand: false};
}
function sentWithMark(text, a, b){ return esc(text.slice(0,a)) + '<mark>' + esc(text.slice(a,b)) + '</mark>' + esc(text.slice(b)); }
function gramPointsSection(p){
  if(!p.gp || !p.gp.length){
    return `<section class="sec"><div class="sec-head"><h2>Phân tích ngữ pháp & cấu trúc hay</h2></div>
      <div class="gr">${p.gr.map(g=>`<div class="g"><b>${esc(g[0])}</b><div>${esc(g[1])}</div></div>`).join('')}</div></section>`;
  }
  const cards = p.gp.map((pt,i)=>{
    const f = pointInfo(pt); const o = pt.o || [];
    const ex = !f.hand && o.length ? `<div class="gex">Ví dụ trong bài: “${sentWithMark(p.ss[o[0][0]][0], o[0][1], o[0][2])}”</div>` : '';
    return `<div class="g gp" data-gp="${i}" tabindex="0">
      <div class="gph"><b>${esc(f.name)}</b>${f.lv?`<span class="badge ${f.lv}">${f.lv}</span>`:''}<span class="gcnt">${o.length ? o.length+' chỗ trong bài' : ''}</span></div>
      ${f.form?`<div class="gform">${esc(f.form)}</div>`:''}
      <div>${esc(f.expl)}</div>${ex}</div>`;
  }).join('');
  return `<section class="sec">
    <div class="sec-head"><h2>Ngữ pháp trong đoạn (${p.gp.length})</h2><button class="chip" id="toGram">Phân tích từng câu →</button></div>
    <p class="note" style="margin:-4px 0 12px">Bấm vào một điểm để tô sáng mọi chỗ dùng nó trong đoạn văn ở trên.</p>
    <div class="gr">${cards}</div>
  </section>`;
}
function markRange(el, a, b){
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let pos = 0, n; const todo = [];
  while((n = tw.nextNode())){
    const L = n.data.length; const s0 = Math.max(a, pos), e0 = Math.min(b, pos + L);
    if(s0 < e0) todo.push([n, s0 - pos, e0 - pos]);
    pos += L; if(pos >= b) break;
  }
  const out = [];
  todo.forEach(([n, s0, e0])=>{ try{ const r = document.createRange(); r.setStart(n, s0); r.setEnd(n, e0); const m = document.createElement('mark'); m.className = 'gm'; r.surroundContents(m); out.push(m); }catch(e){} });
  return out;
}
function clearMarks(){ $$('mark.gm').forEach(m=>{ const pnt = m.parentNode; m.replaceWith(...m.childNodes); pnt && pnt.normalize(); }); }
function bindGramCards(p){
  const tg = $('#toGram'); if(tg) tg.onclick = () => { opts.mode = 'gram'; saveO(); renderPara(); window.scrollTo({top:0}); };
  $$('.gp[data-gp]').forEach(card=>{
    const act = () => {
      const i = +card.dataset.gp; const was = card.classList.contains('on');
      $$('.gp.on').forEach(x=>x.classList.remove('on')); clearMarks();
      if(was) return;
      card.classList.add('on');
      let first = null;
      (p.gp[i].o || []).forEach(([si,a,b])=>{ const el = document.querySelector(`#text .sn[data-s="${si}"]`); if(el){ const ms = markRange(el, a, b); if(!first && ms.length) first = ms[0]; } });
      if(first) first.scrollIntoView({block:'center', behavior:'smooth'});
    };
    card.onclick = e => { if(e.target.closest('.w')) return; act(); };
    card.onkeydown = e => { if(e.key==='Enter' || e.key===' '){ e.preventDefault(); act(); } };
  });
}
function renderSent(text, g, hl){
  const cuts = new Set([0, text.length]);
  g.r.forEach(r=>{ cuts.add(r[0]); cuts.add(r[1]); });
  const br = [];
  g.c.forEach((c,i)=>{ if(isMainType(c[0])) return; br.push({s:c[10], e:c[11], n:i+1}); cuts.add(c[10]); cuts.add(c[11]); });
  (hl||[]).forEach(([a,b])=>{ cuts.add(a); cuts.add(b); });
  const pts = [...cuts].filter(x=>x>=0 && x<=text.length).sort((a,b)=>a-b);
  let out = '';
  for(let k=0; k<pts.length; k++){
    const p0 = pts[k];
    br.filter(b=>b.e===p0).sort((x,y)=>y.s-x.s).forEach(()=>{ out += '<span class="cb">]</span>'; });
    br.filter(b=>b.s===p0).sort((x,y)=>y.e-x.e).forEach(b=>{ out += `<span class="cb">[<sub>${b.n}</sub></span>`; });
    if(k===pts.length-1) break;
    const p1 = pts[k+1]; const seg = text.slice(p0, p1);
    const run = g.r.find(r=>r[0]<=p0 && p1<=r[1]);
    const h = (hl||[]).some(([a,b])=>a<=p0 && p1<=b);
    const cls = (run ? 'r-'+run[2] : '') + (h ? ' gh' : '');
    out += cls.trim() ? `<span class="${cls.trim()}"${run?` title="${ROLE_VI[run[2]]||''}${run[3]>=0?' · MĐ'+(run[3]+1):''}"`:''}>${esc(seg)}</span>` : esc(seg);
  }
  return out;
}
function depthOf(g, i){ let d = 0, c = g.c[i]; let guard = 0; while(c && c[6] >= 0 && guard++ < 12){ if(!isMainType(c[0])) d++; c = g.c[c[6]]; } return d; }
function gramBody(p){
  const G = p.g || [];
  if(!G.length) return '<div class="card practice">Chưa có dữ liệu phân tích cho đoạn này.</div>';
  const pts = p.gp || [];
  const selPt = gSel >= 0 ? pts[gSel] : null;
  const occBy = {}; if(selPt) (selPt.o||[]).forEach(([si,a,b])=>{ (occBy[si] = occBy[si] || []).push([a,b]); });
  const info = selPt ? pointInfo(selPt) : null;
  const top = `<div class="card gtop">
    <div class="gt-h"><b>Điểm ngữ pháp trong đoạn</b><span class="note">Bấm để tô sáng các câu dùng cấu trúc đó</span></div>
    <div class="gchips">${pts.map((pt,i)=>{ const f = pointInfo(pt); return `<button class="gchip ${gSel===i?'on':''}" data-gp="${i}">${esc(f.name)}${(pt.o||[]).length?`<small>${pt.o.length}</small>`:''}</button>`; }).join('')}</div>
    ${info ? `<div class="gsel"><b>${esc(info.name)}</b>${info.lv?` <span class="badge ${info.lv}">${info.lv}</span>`:''}${info.form?`<div class="gform">${esc(info.form)}</div>`:''}<div>${esc(info.expl)}</div>${(selPt.o||[]).length?'':'<div class="note">Điểm này không gắn với một câu cụ thể.</div>'}</div>` : ''}
    <div class="glegend">${['S','V','O','C','A','K'].map(r=>`<span><i class="rk k-${r}">${r}</i>${ROLE_VI[r]}</span>`).join('')}<span><span class="cb">[<sub>2</sub> … ]</span> mệnh đề phụ số 2</span></div>
    <div class="gtools"><button class="chip ${opts.gVi?'on':''}" id="gVi">Nghĩa tiếng Việt</button><button class="chip ${opts.gAll?'on':''}" id="gAll">Mở chi tiết tất cả</button><button class="chip ${opts.gHard?'on':''}" id="gHard">Chỉ câu khó 💡</button></div>
  </div>`;
  const list = G.map((g,k)=>{
    if(opts.gHard && !g.n) return '';
    const [en, vi] = p.ss[k];
    const open = opts.gAll || gOpen.has(k);
    const dim = selPt && !occBy[k];
    const tens = [...new Set(g.c.filter(c=>c[5] && c[3]).map(c=>tenseLabel(c[3]) + (c[4]?' · bị động':'')))].filter(Boolean);
    const sp = (pts.map((pt,i)=>[pt,i]).filter(([pt])=>(pt.o||[]).some(o=>o[0]===k)));
    let det = '';
    if(open){
      det = `<div class="cls">${g.c.map((c,i)=>{
        const d = depthOf(g, i);
        const t = tenseLabel(c[3]);
        const rl = c[8].map(([r,x])=>`<span class="rr"><i class="rk k-${r}" title="${ROLE_VI[r]||''}">${ROLE_SHORT[r]||r}</i>${esc(x).replace(/\[MĐ(\d+)\]/g,'<span class="mref">MĐ$1</span>')}</span>`).join('');
        const par = c[6] >= 0 && !isMainType(c[0]) ? `<span class="muted"> · thuộc MĐ${c[6]+1}</span>` : '';
        return `<div class="clr" style="margin-left:${d*18}px"><div class="clh"><b>MĐ${i+1}</b><span>${clauseLabel(c)}${par}</span>${t?`<span class="tchip ${c[5]?'':'nf'}">${t}${c[4]?' · bị động':''}</span>`:''}</div><div class="rl">${rl}</div></div>`;
      }).join('')}</div>
      ${sp.length?`<div class="spts">Điểm ngữ pháp: ${sp.map(([pt,i])=>`<button class="gchip sm ${gSel===i?'on':''}" data-gp="${i}">${esc(pointInfo(pt).name)}</button>`).join('')}</div>`:''}`;
    }
    return `<div class="sa ${dim?'dim':''}" id="sa-${k}">
      <div class="sah"><span class="san">${k+1}</span><span class="stype">${STYPE[g.t]||''}</span>${tens.map(t=>`<span class="tchip">${esc(t)}</span>`).join('')}${g.n?'<span class="hardb">💡 Câu khó</span>':''}<span class="sp"></span><button class="spk" data-say-s="${k}" title="Nghe câu này">${SPK}</button><button class="chip" data-x="${k}">${open?'Thu gọn':'Chi tiết'}</button></div>
      <div class="sat">${renderSent(en, g, occBy[k])}</div>
      ${opts.gVi?`<div class="sav">${esc(vi)}</div>`:''}
      ${g.n?`<div class="snote">💡 ${esc(g.n)}</div>`:''}
      ${det}
    </div>`;
  }).join('');
  return top + `<div class="salist">${list}</div><p class="note" style="margin-top:14px">Phần tách mệnh đề và vai trò (S, V, O…) được tạo tự động bằng công cụ phân tích cú pháp, nên đôi khi có chỗ chưa chính xác. Phần 💡 là giải thích viết tay cho những câu khó.</p>`;
}
function bindGram(p){
  const rer = keepY => { const y = scrollY; renderPara(); if(keepY) scrollTo(0, y); };
  $$('[data-gp]').forEach(b=>b.onclick=()=>{
    const i = +b.dataset.gp; gSel = gSel===i ? -1 : i; rer(true);
    if(gSel >= 0){ const first = (p.gp[gSel].o||[])[0]; if(first){ const el = document.getElementById('sa-'+first[0]); if(el && b.closest('.gtop')) el.scrollIntoView({block:'center', behavior:'smooth'}); } }
  });
  $$('[data-x]').forEach(b=>b.onclick=()=>{ const k = +b.dataset.x; if(opts.gAll){ opts.gAll=false; saveO(); G_all_to_open(p); } if(gOpen.has(k)) gOpen.delete(k); else gOpen.add(k); rer(true); });
  $$('[data-say-s]').forEach(b=>b.onclick=()=>speak(p.ss[+b.dataset.sayS][0]));
  $('#gVi').onclick = () => { opts.gVi = !opts.gVi; saveO(); rer(true); };
  $('#gAll').onclick = () => { opts.gAll = !opts.gAll; if(!opts.gAll) gOpen = new Set(); saveO(); rer(true); };
  $('#gHard').onclick = () => { opts.gHard = !opts.gHard; saveO(); rer(true); };
}
function G_all_to_open(p){ gOpen = new Set((p.g||[]).map((_,k)=>k)); }


/* ---------- reading comprehension ---------- */
const TFL = ['True', 'False', 'Not Given'];
function rcState(p){ const s = Object.assign({ans:{}, sub:false, best:null, open:''}, store.get('rc_'+p.n, {})); return s; }
function rcSave(p, s){ store.set('rc_'+p.n, {ans:s.ans, sub:s.sub, best:s.best, open:s.open}); }
function rcScore(p, s){ let c = 0, t = 0; (p.qz||[]).forEach((q,i)=>{ if(q.t==='O') return; t++; if(s.ans[i]===q.a) c++; }); return [c, t]; }
function rcMeta(p){ if(!p.qz || !p.qz.length) return ''; const s = rcState(p); return s.best!=null ? `<span>· đọc hiểu ${s.best}/${p.qz.filter(q=>q.t!=='O').length}</span>` : ''; }
let rcHideText = false;
function rcBody(p){
  const Q = p.qz || [];
  if(!Q.length) return '<div class="card practice">Đoạn này chưa có bài đọc hiểu.</div>';
  const s = rcState(p); const sub = s.sub;
  const [c, t] = rcScore(p, s);
  const answered = Q.filter((q,i)=>q.t!=='O' && s.ans[i]!=null).length;
  const qcard = (q, i) => {
    const mine = s.ans[i]; const ok = sub && mine===q.a; const bad = sub && mine!==q.a;
    let opts = '';
    if(q.t==='M'){
      opts = `<div class="qopts">${q.o.map((o,k)=>{
        const cls = sub ? (k===q.a ? 'right' : (k===mine ? 'wrong' : '')) : (k===mine ? 'sel' : '');
        return `<button class="qo ${cls}" data-q="${i}" data-k="${k}" ${sub?'disabled':''}><span class="ql">${'ABCD'[k]}</span><span>${esc(o)}</span></button>`;
      }).join('')}</div>`;
    } else {
      opts = `<div class="qopts tf">${TFL.map((o,k)=>{
        const cls = sub ? (k===q.a ? 'right' : (k===mine ? 'wrong' : '')) : (k===mine ? 'sel' : '');
        return `<button class="qo ${cls}" data-q="${i}" data-k="${k}" ${sub?'disabled':''}>${o}</button>`;
      }).join('')}</div>`;
    }
    const exp = sub ? `<div class="qexp ${ok?'ok':'no'}"><b>${ok ? '✓ Đúng' : (mine==null ? '— Chưa trả lời' : '✗ Chưa đúng')}</b> · Đáp án: <b>${q.t==='M' ? 'ABCD'[q.a] : TFL[q.a]}</b><div>${esc(q.e)}</div>${q.r ? `<div class="qquote">“${q.r.map(r=>esc(p.ss[r[0]][0].slice(r[1], r[2]))).join(' ')}” <button class="chip" data-show="${i}">Xem trong bài ↑</button></div>` : ''}</div>` : '';
    return `<div class="qc ${sub?(ok?'is-ok':'is-bad'):''}" id="qc-${i}"><div class="qh"><span class="qn">${i+1}</span><div class="qq">${esc(q.q)}</div></div>${opts}${exp}</div>`;
  };
  const M = Q.map((q,i)=>[q,i]).filter(([q])=>q.t==='M');
  const T = Q.map((q,i)=>[q,i]).filter(([q])=>q.t==='T');
  const O = Q.map((q,i)=>[q,i]).filter(([q])=>q.t==='O');
  const openCard = ([q,i]) => {
    const wc = (s.open.trim().match(/\S+/g)||[]).length;
    return `<div class="qc"><div class="qh"><span class="qn">${i+1}</span><div class="qq">${esc(q.q)}</div></div>
      <div class="note" style="margin:0 0 8px">💡 ${esc(q.h)}</div>
      <textarea class="ans" id="rcOpen" placeholder="Viết câu trả lời bằng tiếng Anh (${q.w[0]}–${q.w[1]} từ)…">${esc(s.open)}</textarea>
      <div class="acts"><span class="note" id="rcWc">${wc} từ · mục tiêu ${q.w[0]}–${q.w[1]}</span><span class="sp"></span><button class="btn" id="rcCopy">Sao chép để nhờ Claude chữa</button></div>
      <div class="note" id="rcCopyMsg"></div></div>`;
  };
  const scoreBox = sub ? `<div class="card rcscore"><div><b class="big ${c/t>=0.8?'good':c/t>=0.5?'mid':'low'}">${c}/${t}</b><span>câu đúng${s.best!=null && s.best!==c ? ` · cao nhất ${s.best}/${t}` : ''}</span></div><div class="note">${c===t ? 'Xuất sắc! Bạn đã hiểu bài rất kỹ.' : 'Đọc phần giải thích ở từng câu và bấm “Xem trong bài” để thấy câu trích dẫn.'}</div><button class="btn" id="rcRetry">Làm lại</button></div>` : '';
  return `<div class="card rctext">
      <div class="rch"><b>Bài đọc</b><span class="note">Đọc kỹ rồi trả lời. Muốn luyện khó hơn thì ẩn bài đọc đi.</span><span class="sp"></span><button class="chip ${rcHideText?'on':''}" id="rcHide">${rcHideText?'Hiện bài đọc':'Ẩn bài đọc'}</button></div>
      <div class="text nohl rcbody ${rcHideText?'hidden':''}" id="rcText">${p.en}</div>
    </div>
    ${scoreBox}
    <section class="sec"><div class="sec-head"><h2>Phần 1 · Trắc nghiệm</h2><small>Chọn đáp án đúng nhất</small></div><div class="qlist">${M.map(([q,i])=>qcard(q,i)).join('')}</div></section>
    <section class="sec"><div class="sec-head"><h2>Phần 2 · True / False / Not Given</h2></div>
      <p class="note" style="margin:-4px 0 12px"><b>True</b>: thông tin đúng với bài · <b>False</b>: trái với bài · <b>Not Given</b>: bài không nhắc đến, không đủ thông tin để kết luận.</p>
      <div class="qlist">${T.map(([q,i])=>qcard(q,i)).join('')}</div></section>
    ${sub ? '' : `<div class="card rcsubmit"><span class="note">Đã trả lời ${answered}/${t} câu</span><span class="sp"></span><button class="btn pri" id="rcSubmit">Nộp bài</button></div>`}
    <section class="sec"><div class="sec-head"><h2>Phần 3 · Câu hỏi mở</h2><small>Tự viết, rồi nhờ Claude chữa</small></div>${O.map(openCard).join('')}</section>`;
}
function bindRc(p){
  const s = rcState(p);
  const rer = () => { const y = scrollY; renderPara(); scrollTo(0, y); };
  $$('.qo[data-q]').forEach(b=>b.onclick=()=>{ if(s.sub) return; const i = +b.dataset.q; s.ans[i] = +b.dataset.k; rcSave(p, s);
    $$(`.qo[data-q="${i}"]`).forEach(x=>x.classList.toggle('sel', x===b));
    const t = (p.qz||[]).filter(q=>q.t!=='O').length; const a = (p.qz||[]).filter((q,j)=>q.t!=='O' && s.ans[j]!=null).length;
    const n = $('.rcsubmit .note'); if(n) n.textContent = `Đã trả lời ${a}/${t} câu`; });
  const sb = $('#rcSubmit'); if(sb) sb.onclick = () => {
    const [c] = rcScore(p, s); s.sub = true; s.best = Math.max(s.best==null ? 0 : s.best, c); rcSave(p, s);
    renderPara(); const sc = $('.rcscore'); if(sc) sc.scrollIntoView({block:'center', behavior:'smooth'});
  };
  const rt = $('#rcRetry'); if(rt) rt.onclick = () => { s.ans = {}; s.sub = false; rcSave(p, s); renderPara(); const t = $('.qlist'); if(t) t.scrollIntoView({block:'start'}); };
  $('#rcHide').onclick = () => { rcHideText = !rcHideText; rer(); };
  $$('[data-show]').forEach(b=>b.onclick=()=>{
    const q = p.qz[+b.dataset.show]; if(!q.r) return;
    if(rcHideText){ rcHideText = false; rer(); }
    clearMarks();
    let first = null;
    q.r.forEach(r=>{ const el = document.querySelector(`#rcText .sn[data-s="${r[0]}"]`); if(el){ const ms = markRange(el, r[1], r[2]); if(!first) first = ms[0] || el; } });
    if(first) first.scrollIntoView({block:'center', behavior:'smooth'});
  });
  const ta = $('#rcOpen');
  if(ta){
    const oq = p.qz.find(q=>q.t==='O');
    ta.addEventListener('input', ()=>{ s.open = ta.value; rcSave(p, s); const wc = (ta.value.trim().match(/\S+/g)||[]).length; $('#rcWc').textContent = `${wc} từ · mục tiêu ${oq.w[0]}–${oq.w[1]}`; });
    $('#rcCopy').onclick = () => {
      if(!ta.value.trim()){ $('#rcCopyMsg').textContent = 'Bạn chưa viết gì.'; return; }
      const txt = `Mình đang luyện viết sau khi đọc đoạn "${p.t}" (cấp ${p.lv}). Câu hỏi: ${oq.q}\n\nBài viết của mình:\n${ta.value.trim()}\n\nHãy chữa bài giúp mình: sửa lỗi ngữ pháp, từ vựng, collocation; gợi ý cách diễn đạt tự nhiên hơn; nhận xét nội dung có trả lời đúng câu hỏi chưa; giải thích ngắn gọn bằng tiếng Việt và cho mình một bản đã sửa hoàn chỉnh.`;
      copyText(txt).then(()=>{ $('#rcCopyMsg').textContent = '✓ Đã sao chép. Dán vào khung chat với Claude để được chữa bài.'; }).catch(()=>{ $('#rcCopyMsg').textContent = 'Không sao chép được trên trình duyệt này.'; });
    };
  }
  $$('#rcText .w').forEach(el=>el.onclick=e=>{ e.stopPropagation(); showPop(el); });
}

/* ---------- routing ---------- */
function render(){ if(view==='review') renderReview(); else renderPara(); }
function go(i, flashA){
  if(i<0||i>=P.length) return; if(i!==cur){ gSel=-1; gOpen=new Set(); } cur=i; store.set('cur',cur); hidePop(); stopSpeech();
  view = 'para'; $('#revBtn').classList.remove('on');
  if(flashA && opts.mode!=='read'){ opts.mode='read'; saveO(); }
  $$('.item').forEach(el=>el.classList.toggle('on', +el.dataset.i===cur));
  renderPara();
  const on = document.querySelector('.item.on'); if(on) on.scrollIntoView({block:'nearest'});
  if(flashA){
    const el = [...$$('#text .w')].find(e=>e.dataset.a===flashA);
    if(el){ el.scrollIntoView({block:'center'}); el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),2200); return; }
  }
  window.scrollTo({top:0});
}
$('#revBtn').onclick = () => {
  hidePop(); stopSpeech(); closeSide();
  if(view==='review'){ go(cur); return; }
  view = 'review'; sess = null; $('#revBtn').classList.add('on');
  $$('.item').forEach(el=>el.classList.remove('on'));
  renderReview(); window.scrollTo({top:0});
};

/* ---------- popover ---------- */
function showPop(el){
  const a = el.dataset.a, d = D[a]; const done = learned.has(a);
  let x='';
  if(isAdv(d.l)){ if(d.c) x+=`<div><b>Collocation:</b> ${esc(d.c)}</div>`; if(d.f) x+=`<div><b>Word family:</b> ${esc(d.f)}</div>`; }
  const pop = $('#pop');
  pop.innerHTML = `<div class="ph"><span class="pw">${esc(d.w)}</span>${d.s?`<span class="vs">(${esc(d.s)})</span>`:''}<span class="vp">${esc(d.p)}</span><span class="badge ${d.l}">${d.l}</span></div>
    <div class="pm">${esc(d.m)}</div>${x?`<div class="px">${x}</div>`:''}
    <div class="pa"><button class="spk" data-say="${esc(d.w)}">${SPK}</button><button class="chk ${done?'on':''}" data-learn="${esc(a)}">${done?'✓ Đã thuộc':'Đánh dấu thuộc'}</button></div>`;
  pop.classList.add('on');
  const r = el.getBoundingClientRect(); const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = Math.min(Math.max(8, r.left + r.width/2 - pw/2), innerWidth - pw - 8);
  let top = r.bottom + 8; if(top + ph > innerHeight - 8) top = r.top - ph - 8;
  pop.style.left = left+'px'; pop.style.top = Math.max(8,top)+'px';
  pop.querySelector('[data-say]').onclick=e=>{ e.stopPropagation(); speak(d.w); };
  pop.querySelector('[data-learn]').onclick=e=>{ e.stopPropagation(); toggleLearn(a); };
}
function hidePop(){ $('#pop').classList.remove('on'); }
document.addEventListener('click', e=>{ if(!e.target.closest('#pop')) hidePop(); if(!e.target.closest('.search')) $('#results').classList.remove('on'); });
addEventListener('scroll', hidePop, {passive:true});

/* ---------- search ---------- */
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d');
const INDEX = Object.entries(D).map(([a,d])=>({a, w:d.w.toLowerCase(), m:norm(d.m)}));
let sel = -1, hits = [];
$('#q').addEventListener('input', ()=>{
  const q = $('#q').value.trim().toLowerCase(); const nq = norm(q);
  if(!q){ $('#results').classList.remove('on'); return; }
  const starts=[], contains=[], mean=[];
  for(const it of INDEX){
    if(it.w.startsWith(q)) starts.push(it); else if(it.w.includes(q)) contains.push(it); else if(nq.length>2 && it.m.includes(nq)) mean.push(it);
  }
  starts.sort((x,y)=>x.w.length-y.w.length||x.w.localeCompare(y.w));
  hits = [...starts, ...contains, ...mean].slice(0,40); sel = hits.length?0:-1;
  $('#results').innerHTML = hits.length ? hits.map((h,i)=>{ const d=D[h.a]; const pi=firstPara[h.a];
    return `<div class="res ${i===sel?'sel':''}" data-i="${i}"><span class="rw">${esc(d.w)}${d.s?` <span class="vs">(${esc(d.s)})</span>`:''}</span><span class="rm">${esc(d.m)}</span><span class="rp"><span class="badge ${d.l}">${d.l}</span> Đ.${P[pi].n}</span></div>`; }).join('')
    : '<div class="res"><span class="rm">Không tìm thấy từ này trong danh sách.</span></div>';
  $('#results').classList.add('on');
  $$('.res[data-i]').forEach(el=>el.onclick=()=>pick(+el.dataset.i));
});
$('#q').addEventListener('keydown', e=>{
  if(!hits.length) return;
  if(e.key==='ArrowDown'){ sel=Math.min(sel+1,hits.length-1); e.preventDefault(); }
  else if(e.key==='ArrowUp'){ sel=Math.max(sel-1,0); e.preventDefault(); }
  else if(e.key==='Enter'){ pick(sel); return; } else return;
  $$('.res').forEach((el,i)=>el.classList.toggle('sel',i===sel));
  const s=document.querySelector('.res.sel'); if(s) s.scrollIntoView({block:'nearest'});
});
function pick(i){ const h=hits[i]; if(!h) return; $('#results').classList.remove('on'); $('#q').blur(); sess=null;
  const pi = firstPara[h.a]; if(opts.lvTab!=='all' && P[pi].lv!==opts.lvTab){ opts.lvTab='all'; saveO(); buildSide(); updateProgress(); }
  go(pi, h.a); }

/* ---------- keyboard ---------- */
document.addEventListener('keydown', e=>{
  if(e.ctrlKey || e.metaKey || e.altKey) return;
  const inField = e.target.closest('input,textarea');
  if(view==='review'){
    if(inField || !sess || sess.k>=sess.q.length) return;
    if(!sess.revealed){ if(sess.dir==='en' && (e.key===' '||e.key==='Enter')){ e.preventDefault(); reveal(); } return; }
    if(['1','2','3'].includes(e.key)){ e.preventDefault(); doGrade(+e.key-1); }
    else if((e.key==='Enter'||e.key===' ') && sess.sug!=null){ e.preventDefault(); doGrade(sess.sug); }
    return;
  }
  if(inField) return;
  if(opts.mode==='type' && e.key.length===1 && e.key!=='/' && !e.target.closest('button')){ const i = $('#tyIn'); if(i && TY && !TY.done){ i.focus({preventScroll:true}); return; } }
  if(e.key==='ArrowRight') go(cur+1); else if(e.key==='ArrowLeft') go(cur-1);
  else if(e.key==='/'){ e.preventDefault(); $('#q').focus(); }
});

buildSide(); render(); updateProgress(); updateDue();
const on0 = document.querySelector('.item.on'); if(on0) on0.scrollIntoView({block:'center'});
