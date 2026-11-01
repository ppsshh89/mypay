const CACHE_NAME = 'smart-pay-v9.6.1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png'
];

// 1. 설치 즉시 대기 상태 없이 새 서비스 워커 활성화
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => {})
  );
});

// 2. 활성화 즉시 이전 버전 캐시 전부 삭제 및 제어권 확보
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// 3. 네트워크 우선(Network-First) 전략: 인터넷 연결 시 무조건 최신 파일 로드 후 캐시 갱신, 오프라인 시 캐시 반환
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // GitHub Gist API 등 외부 API 요청은 캐시하지 않고 바로 통과
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
