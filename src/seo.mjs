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
function verificationTags() {
  const out = [];
  const naver = (process.env.NAVER_VERIFY || '').trim();
  const google = (process.env.GOOGLE_VERIFY_META || '').trim();
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
  t.push(`<meta property="og:site_name" content="K-POP 판매처별 특전 비교">`);
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
export function displayArtist(en, ko) {
  if (!ko) return en;
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
  if (norm(ko) === norm(en)) return en; // 이미 같은 표기
  if (en.includes(ko)) return en; // "i-dle (아이들)"처럼 이미 병기됨
  return `${ko}(${en})`;
}

/** 상품명에서 한글 아티스트명을 뽑는다 — "코르티스 - EP 2집 GREENGREEN …" */
export function koreanArtistFrom(titles) {
  const counts = new Map();
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
  }
  if (!counts.size) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
