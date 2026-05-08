<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Image assets

`public/images/` 안의 모든 그림은 카테고리별 max-width 규격으로 다운샘플 + WebP 변환된 상태다. 새 PNG를 추가하면 `npm run dev`/`npm run build` 시 `predev`/`prebuild` 훅이 `optimize-images` 스크립트를 자동으로 돌려 WebP로 교체하고 원본 PNG를 삭제한다 (스크립트는 idempotent — 이미 변환된 상태면 빠르게 통과). 새 카테고리 폴더를 만들 때는 `scripts/optimize-images.mjs` 상단 `PROFILES`에 max-width/quality를 한 줄 추가해야 처리된다.
