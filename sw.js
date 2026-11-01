const CACHE_NAME = 'smart-pay-calc-v9.6';

// 최초 설치 시 기기에 저장할 필수 파일 목록
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com'
];

// 1. 설치(Install): 필수 리소스 및 Tailwind CDN 캐싱
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (const url of CORE_ASSETS) {
        try {
          // 외부 CDN(Tailwind)도 오프라인에서 동작하도록 요청 및 저장
          const req = url.startsWith('http')
            ? new Request(url, { mode: 'no-cors' })
            : new Request(url, { cache: 'reload' });
          const res = await fetch(req);
          await cache.put(url, res);
        } catch (err) {
          console.warn('[SW] 초기 캐싱 건너뜀:', url);
        }
      }
    })
  );
});

// 2. 활성화(Activate): 이전 버전 캐시 자동 정리
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// 3. 네트워크 요청 가로채기(Fetch)
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // [중요] GET 요청이 아니거나 깃허브 Gist 백업/복원 API 요청은 무조건 실시간 네트워크 사용
  if (req.method !== 'GET' || url.hostname.includes('api.github.com')) {
    return;
  }

  // HTML 페이지 이동 요청: 네트워크 우선 시도 후 오프라인이면 캐시된 index.html 반환
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(networkRes => {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', clone));
          return networkRes;
        })
        .catch(() => caches.match('./index.html') || caches.match('./'))
    );
    return;
  }

  // 정적 파일(아이콘, Tailwind CSS 등): 캐시 우선 반환 + 백그라운드 업데이트(Stale-While-Revalidate)
  event.respondWith(
    caches.match(req).then(cachedRes => {
      const fetchPromise = fetch(req)
        .then(networkRes => {
          if (networkRes && (networkRes.status === 200 || networkRes.type === 'opaque')) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => cachedRes);

      return cachedRes || fetchPromise;
    })
  );
});
