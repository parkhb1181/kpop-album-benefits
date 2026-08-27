
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// 푸시에는 내용이 실려 있지 않다(암호화를 피하려고). 깨어나서 직접 읽어온다.
self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let title = '새 예약판매가 올라왔습니다';
    let body = '';
    let url = '/';
    try {
      const r = await fetch('/api/latest', { cache: 'no-store' });
      const d = await r.json();
      const list = (d && d.new) || [];
      if (list.length === 1) {
        title = list[0].artist + ' — ' + list[0].album;
        body = '예약판매가 시작됐습니다. 판매처별 특전을 비교해 보세요.';
        url = '/album/' + list[0].slug;
      } else if (list.length > 1) {
        title = '새 예약판매 ' + list.length + '개';
        body = list.map((x) => x.artist).slice(0, 4).join(', ');
      }
    } catch (err) {}
    await self.registration.showNotification(title, {
      body: body,
      icon: '/og/icon.png',
      badge: '/og/icon.png',
      tag: 'new-preorder',
      data: { url: url }
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) { c.navigate(url); return c.focus(); }
    }
    return self.clients.openWindow(url);
  })());
});
