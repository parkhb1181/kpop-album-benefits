import { configured } from './_store.js';
import { listPending, listApproved, decide } from './_reports.js';

/**
 * 제보 검수 화면. 운영자 한 명이 쓰는 곳이다.
 *
 * 여기가 이 기능의 전부다. 저장소를 뭘 쓰느냐보다 **사람이 눈으로 보고 통과시키는 단계**가
 * 있느냐가 서비스의 생사를 가른다. 검수 없이 열면 반드시 이상한 게 올라온다.
 *
 * 접근은 REVIEW_SECRET으로 막는다. 없으면 화면 자체를 안 연다 —
 * "설정 안 했으니 일단 열어둔다"는 공개 사이트에서 가장 하면 안 되는 기본값이다.
 */

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default async function handler(req, res) {
  const secret = process.env.REVIEW_SECRET;
  if (!secret) return res.status(503).send('REVIEW_SECRET 미설정 — 검수 화면을 열지 않습니다');

  const given = req.query?.k || (req.headers.authorization || '').replace(/^Bearer /, '');
  if (given !== secret) return res.status(401).send('권한 없음');
  if (!configured) return res.status(503).send('저장소 미설정');

  // 승인·거절
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const r = await decide(String(body.id || ''), body.approve === true);
    return res.status(r.ok ? 200 : 404).json(r);
  }

  const pending = await listPending();
  const approved = await listApproved();

  const cards = pending.length
    ? pending
        .map(
          (r) => `<figure data-id="${esc(r.id)}">
<img src="${esc(r.url)}" alt="제보 이미지" loading="lazy">
<figcaption>${esc(r.slug)}${r.versionKey ? ` · ${esc(r.versionKey)}` : ''}${r.retailer ? ` · ${esc(r.retailer)}` : ''}
${r.note ? `<div class="note">${esc(r.note)}</div>` : ''}
<div class="meta">${esc(r.at)} · ${Math.round(r.bytes / 1024)}KB</div>
<div class="btns"><button class="ok" data-a="1">승인</button><button class="no" data-a="0">거절</button></div>
</figcaption></figure>`
        )
        .join('')
    : '<p class="empty">대기 중인 제보가 없습니다.</p>';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // 검색엔진에 절대 들어가면 안 되는 화면이다
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(`<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>제보 검수</title><style>
:root{--bg:#111;--fg:#eee;--mut:#999;--line:#333;--ok:#4ade80;--no:#f87171}
body{margin:0;padding:20px;background:var(--bg);color:var(--fg);font:15px/1.6 -apple-system,"Pretendard",sans-serif}
h1{font-size:18px;margin:0 0 4px}.sub{color:var(--mut);font-size:13px;margin-bottom:18px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px}
figure{margin:0;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#181818}
figure img{width:100%;display:block;max-height:420px;object-fit:contain;background:#000}
figcaption{padding:10px 12px;font-size:13px}
.note{color:var(--mut);margin-top:6px}.meta{color:var(--mut);font-size:11.5px;margin-top:6px}
.btns{display:flex;gap:8px;margin-top:10px}
button{flex:1;padding:8px;border:1px solid currentColor;background:transparent;border-radius:7px;cursor:pointer;font:inherit;font-size:13px}
.ok{color:var(--ok)}.no{color:var(--no)}
button[disabled]{opacity:.4;cursor:default}
.empty{color:var(--mut)}
</style></head><body>
<h1>제보 검수</h1>
<div class="sub">대기 <b>${pending.length}</b> · 승인됨 <b>${approved.length}</b> — 승인해야 사이트에 나갑니다. 거절하면 이미지가 삭제됩니다.</div>
<div class="grid">${cards}</div>
<script>
var K=new URLSearchParams(location.search).get('k');
document.querySelectorAll('button').forEach(function(b){
  b.addEventListener('click',function(){
    var fig=b.closest('figure'), id=fig.dataset.id, approve=b.dataset.a==='1';
    fig.querySelectorAll('button').forEach(function(x){x.disabled=true});
    fetch(location.pathname+'?k='+encodeURIComponent(K),{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id:id,approve:approve})})
      .then(function(r){return r.json()})
      .then(function(d){ if(d.ok){fig.style.opacity=.25;fig.querySelector('.btns').textContent=approve?'승인됨':'거절됨'}
        else{fig.querySelectorAll('button').forEach(function(x){x.disabled=false})} });
  });
});
</script></body></html>`);
}
