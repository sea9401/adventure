// Adventure RPG service worker — 보수적 PWA 캐시.
// 페이지/API/RSC/Server Action 은 가로채지 않는다 (Next.js 동작 보존).
// 정적 이미지·아이콘·매니페스트만 stale-while-revalidate 로 처리해
//   1) Chrome 의 "앱 설치" 프롬프트 자격(SW + fetch 핸들러) 충족
//   2) 두 번째 방문부터 이미지 즉시 표시 + 잠깐의 오프라인 내성
// 캐시 키 변경 시 CACHE_NAME 의 -vN 을 올리면 activate 단계에서 옛 캐시 자동 폐기.

const CACHE_NAME = "adventure-rpg-v1";

// 가로챌 정적 리소스 패턴. 그 외 경로는 respondWith 호출하지 않아 네트워크가 그대로 처리한다.
const STATIC_PATTERNS = [
  /^\/images\//,
  /^\/icon-\d+\.png$/,
  /^\/icon-maskable-\d+\.png$/,
  /^\/manifest\.webmanifest$/,
];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k)),
        ),
      ),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isStatic = STATIC_PATTERNS.some((re) => re.test(url.pathname));
  if (!isStatic) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const networkPromise = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || networkPromise;
    }),
  );
});
