<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Image assets

`public/images/` 안의 모든 그림은 카테고리별 max-width 규격으로 다운샘플 + WebP 변환된 상태다. 새 PNG를 추가하면 `npm run dev`/`npm run build` 시 `predev`/`prebuild` 훅이 `optimize-images` 스크립트를 자동으로 돌려 WebP로 교체하고 원본 PNG를 삭제한다 (스크립트는 idempotent — 이미 변환된 상태면 빠르게 통과). 새 카테고리 폴더를 만들 때는 `scripts/optimize-images.mjs` 상단 `PROFILES`에 max-width/quality를 한 줄 추가해야 처리된다. 카테고리 안의 서브폴더는 같은 프로필로 자동 재귀 처리.

## 파일명 컨벤션 + 검증

이미지 파일명은 **코드 식별자와 일치**해야 한다 — 매핑이 자동/암묵적으로 풀리도록.

- **지역 (`ui/`)**: `RegionId` 와 동일한 파일명. 예: `id: "plains"` → `ui/plains.webp`. `RegionBackground` 가 `/images/ui/${regionId}.webp` fallback 으로 자동 매핑하므로 `Region` 데이터에 `image:` override 를 두지 말 것.
- **NPC (`npc/`)**: `Npc.portrait` 에 명시. 새 NPC 추가 시 short-name 으로 통일 (`smith.webp`, `bold.webp`, `marin.webp` 식).
- **몬스터 (`monster/`)**: `Monster.image` 에 명시. 키는 한글, 파일은 영문 short-name.

`predev`/`prebuild` 가 `optimize-images` 다음에 `check-images` 를 돌려 두 가지를 검증한다:
1. **참조하지만 없는 파일** → 빌드 실패.
2. **있지만 참조 없는 고아 파일** → 경고 (CI 에서 엄격히 막으려면 `--strict`).

수동으로도 `npm run check-images` 로 언제든 점검 가능.
