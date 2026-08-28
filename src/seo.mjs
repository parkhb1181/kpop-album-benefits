/**
 * 검색·공유 메타.
 *
 * 이 서비스의 유입은 두 갈래다.
 *   ① 검색 — "코르티스 판매처별 특전"처럼 아티스트명이 앞에 붙는 롱테일
 *   ② 팬이 X·카톡에 링크를 퍼가는 것
 *
 * ①은 sitemap과 한글 title이, ②는 OG 카드가 결정한다. 둘 다 여기서 만든다.
 */

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** 절대 URL. siteUrl이 없으면 상대경로만 쓴다(로컬 빌드에서 잘못된 도메인을 박지 않기 위해) */
export const abs = (siteUrl, path) => (siteUrl ? `${siteUrl.replace(/\/$/, '')}/${String(path).replace(/^\//, '')}` : null);

/**
 * <head>에 들어갈 메타 태그.
 * canonical·og:url은 siteUrl이 있을 때만 낸다 — 틀린 절대주소는 없느니만 못하다.
 */
/**
 * 검색엔진 소유 확인 메타태그.
 *
 * 확인 파일(.html) 방식은 이 사이트에서 못 쓴다 —
 * vercel.json 의 cleanUrls:true 가 /x.html 을 /x 로 308 시키는데,
 * 서치콘솔·서치어드바이저는 그 경로에서 200 을 요구한다(실측으로 실패 확인).
 * 그래서 메타태그로 간다.
 *
 * 토큰은 비밀이 아니다 — HTML 에 그대로 나간다.
 * 다만 사이트마다 다르고 도메인을 옮기면 새로 받아야 해서 Variables 로 뺐다.
 */
// 토큰을 코드에 둔다. 환경변수만 쓰면 변수 없는 빌드(로컬 등)가 태그를 조용히 빼고,
// 그 결과가 커밋되면 소유확인이 풀린다 — 실제로 한 번 그렇게 날아갔다.
// 값은 어차피 HTML 에 그대로 나가므로 비밀이 아니다. 환경변수는 덮어쓰기 용도로만 남긴다.
const VERIFY = {
  naver: '57715d7af3e8b922357db2854c0ae8e0fb2eba37',
  google: '', // 구글은 메타태그가 아니라 확인 파일(out/googlef12562bf76a21100.html)로 통과했다
};

function verificationTags() {
  const out = [];
  const naver = (process.env.NAVER_VERIFY || VERIFY.naver || '').trim();
  const google = (process.env.GOOGLE_VERIFY_META || VERIFY.google || '').trim();
  if (/^[A-Za-z0-9_-]{10,}$/.test(naver)) out.push(`<meta name="naver-site-verification" content="${esc(naver)}">`);
  if (/^[A-Za-z0-9_-]{10,}$/.test(google)) out.push(`<meta name="google-site-verification" content="${esc(google)}">`);
  return out;
}

export function metaTags({ title, description, canonical, image, type = 'website' }) {
  const t = verificationTags();
  if (description) {
    t.push(`<meta name="description" content="${esc(description)}">`);
    t.push(`<meta property="og:description" content="${esc(description)}">`);
    t.push(`<meta name="twitter:description" content="${esc(description)}">`);
  }
  if (canonical) {
    t.push(`<link rel="canonical" href="${esc(canonical)}">`);
    t.push(`<meta property="og:url" content="${esc(canonical)}">`);
  }
  t.push(`<meta property="og:type" content="${esc(type)}">`);
  t.push(`<meta property="og:title" content="${esc(title)}">`);
  /**
   * `og:site_name`은 **사이트 이름** 자리다. 여기에 기능 설명(`K-POP 판매처별 특전 비교`)을
   * 넣어놨더니 카카오·X 카드에 제목과 거의 같은 말이 두 번 떴다. 브랜드를 넣는다.
   * 헤더의 브랜드(render.mjs BRAND)와 같은 말이어야 링크를 누른 직후 이름이 안 어긋난다.
   */
  t.push(`<meta property="og:site_name" content="앨범노트">`);
  t.push(`<meta property="og:locale" content="ko_KR">`);
  t.push(`<meta name="twitter:title" content="${esc(title)}">`);
  // 이미지가 있으면 큰 카드, 없으면 요약 카드. 없는데 large를 쓰면 빈 상자가 뜬다.
  t.push(`<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`);
  if (image) {
    t.push(`<meta property="og:image" content="${esc(image)}">`);
    t.push(`<meta name="twitter:image" content="${esc(image)}">`);
  }
  return t.join('\n');
}

/** sitemap.xml — 롱테일 색인의 전부다 */
export function sitemap(siteUrl, entries) {
  const body = entries
    .map(({ path, lastmod, changefreq = 'daily', priority }) => {
      const loc = abs(siteUrl, path);
      if (!loc) return '';
      return `  <url>
    <loc>${esc(loc)}</loc>${lastmod ? `\n    <lastmod>${esc(lastmod)}</lastmod>` : ''}
    <changefreq>${esc(changefreq)}</changefreq>${priority ? `\n    <priority>${esc(priority)}</priority>` : ''}
  </url>`;
    })
    .filter(Boolean)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

/**
 * robots.txt.
 * Yeti(네이버)를 따로 적는 건 관례다 — 국내 팬이 검색하는 곳이 네이버다.
 */
export function robots(siteUrl) {
  const sm = abs(siteUrl, 'sitemap.xml');
  return `User-agent: *
Allow: /

User-agent: Yeti
Allow: /

User-agent: Daumoa
Allow: /
${sm ? `\nSitemap: ${sm}\n` : ''}`;
}

/**
 * 아티스트명 한글 병기.
 * 위버스샵은 영문명만 준다("CORTIS"). 국내 팬은 "코르티스"로 검색한다.
 * 알라딘·사운드웨이브 상품명이 한글이라 거기서 역으로 얻는다.
 */
const normName = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '');

export function displayArtist(en, ko) {
  if (!ko) return en;
  if (normName(ko) === normName(en)) return en; // 이미 같은 표기
  if (en.includes(ko)) return en; // "i-dle (아이들)"처럼 이미 병기됨
  // 상품명이 스토어와 다른 아티스트를 가리켜 이미 "소연 (SOYEON)"으로 완성돼 온 경우.
  // 여기에 스토어명을 또 붙이면 "소연(i-dle (아이들))"이 된다 — 아래 koreanArtistFrom 참고.
  if (ko.includes('(')) return ko;
  return `${ko}(${en})`;
}

/**
 * 상품명에서 한글 아티스트명을 뽑는다 — "코르티스 - EP 2집 GREENGREEN …"
 *
 * `storeArtist`를 받는 이유 —
 * 위버스샵은 솔로 앨범을 **그룹 스토어 밑에** 둔다. 소연 정규 1집의 스토어 아티스트는
 * `i-dle (아이들)`이고, 민호 미니 2집은 `SHINee`다. 그대로 병기하면 `소연(i-dle (아이들))`처럼
 * 괄호가 겹칠 뿐 아니라 **틀린 이름**이 된다.
 *
 * 상품명이 더 믿을 만하다 — 국내 판매처는 `소연 (SOYEON) - 정규 1집 …`으로 적는다.
 * 그래서 괄호 안 영문까지 같이 들고 와서, 그게 스토어 아티스트와 다르면 상품명 쪽을 택한다.
 * 같으면(코르티스/CORTIS) 예전처럼 한글만 돌려준다.
 */
export function koreanArtistFrom(titles, storeArtist) {
  const counts = new Map();
  const alts = new Map(); // 한글명 → 상품명 괄호 안 영문
  for (const raw of titles) {
    let t = String(raw || '')
      .replace(/^\s*\[[^\]]*\]\s*/g, '') // 앞의 [SET] [특전증정/세트] 제거
      .trim();
    const head = t.split(/\s[-–—]\s/)[0].trim();
    // 한글이 실제로 든 것만, 너무 길면 앨범명이 섞인 것
    if (!/[가-힣]/.test(head) || head.length > 20) continue;
    const key = head.replace(/\s*\([^)]*\)\s*/g, '').trim();
    if (!key || !/[가-힣]/.test(key)) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
    const en = (head.match(/\(\s*([A-Za-z][A-Za-z0-9 .&'-]{1,})\s*\)/) || [])[1];
    if (en && !alts.has(key)) alts.set(key, en.trim());
  }
  if (!counts.size) return null;
  const ko = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const en = alts.get(ko);
  // 표기는 아래 displayArtist와 맞춘다 — "코르티스(CORTIS)"와 같은 모양이어야 한다
  if (en && storeArtist && normName(en) !== normName(storeArtist)) return `${ko}(${en})`;
  return ko;
}
