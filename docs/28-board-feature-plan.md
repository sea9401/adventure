# 28. 게시판 기능 — MVP 플랜

> **상태**: 진행 중
> **관련 코드**: `src/app/api/chat/`(참고 패턴), `src/app/api/feedback/`(참고), `src/lib/rate-limit.ts`(재사용), `src/components/game/TabNavigation.tsx`(메뉴 통합)
> **선행**: `docs/27`(코드 구조 정리 완료)

## 0. 한 문장 요약

채팅·피드백 시스템과 동일 패턴(Vercel KV + IP 해시 + rate-limit + Sentry)으로 **단일 카테고리 게시판**을 추가. 글 + 댓글(1단계) + 작성자 본인 수정·삭제 + 신고 → 관리자 큐.

## 1. 활용 자산 (이미 갖춰진 것)

| 자산                                                               | 활용                                              |
| ------------------------------------------------------------------ | ------------------------------------------------- |
| `@vercel/kv`                                                       | 게시글·댓글 저장 (list/get/set 패턴, 채팅과 동일) |
| `@/lib/rate-limit` (`rateLimit`, `getClientIp`, `tooManyRequests`) | IP당 분당 N회 작성 제한                           |
| `IP_SALT` (env)                                                    | IP 해시 — 작성자 본인 매칭용                      |
| `character.name` (zustand)                                         | 작성자 닉네임 — 게임 캐릭터 그대로 사용           |
| Sentry `captureException`                                          | 에러 자동 보고                                    |
| 관리자 콘솔 `/admin`                                               | 신고된 글 큐 추가                                 |
| `TabNavigation` (마을 그룹)                                        | "게시판" 탭 추가 위치                             |

## 2. 비목표 (MVP 범위 외)

- OAuth/이메일 로그인 (닉네임만으로 충분)
- 대댓글 (1단계 댓글만)
- 카테고리 분리 (단일 게시판)
- 이미지/파일 첨부 (텍스트만 — Vercel Blob은 후속 PR)
- 좋아요·검색·페이지네이션 (3,4번째 PR)
- 푸시 알림·실시간

## 3. 데이터 모델

### 3.1 KV 스키마

| Key                | 값                            | 비고                  |
| ------------------ | ----------------------------- | --------------------- |
| `board:posts:list` | `string[]` (게시글 ID)        | 최신순 push, 캡 200개 |
| `board:post:{id}`  | `BoardPost` (JSON)            | 본문 + 댓글 임베드    |
| `board:reports`    | `string[]` (신고된 게시글 ID) | 관리자 큐             |

댓글은 게시글 객체에 임베드(comments 배열). 1글당 댓글 캡 100개. 단순성 우선 — 별도 키로 분리 시 4중 fetch 발생.

### 3.2 타입 (`src/lib/board/types.ts`)

```ts
export type BoardPost = {
  id: string; // ${timestamp}-${random4}
  title: string; // ≤ 50자
  body: string; // ≤ 2000자
  nickname: string; // ≤ 20자 (game character.name)
  ipHash: string; // SHA256(ip + IP_SALT)
  at: number;
  updatedAt?: number;
  comments: BoardComment[];
  reportCount: number;
};

export type BoardComment = {
  id: string;
  body: string; // ≤ 500자
  nickname: string;
  ipHash: string;
  at: number;
};

// 목록 응답 — body·comments 제외해 가벼운 페이로드
export type BoardListItem = {
  id: string;
  title: string;
  nickname: string;
  at: number;
  commentCount: number;
};
```

## 4. API 라우트

| Method · Path                           | 동작                    | Rate Limit |
| --------------------------------------- | ----------------------- | ---------- |
| `GET /api/board`                        | 목록 (최신 N개)         | —          |
| `POST /api/board`                       | 게시글 작성             | 5/시간/IP  |
| `GET /api/board/[id]`                   | 단일 게시글 (댓글 포함) | —          |
| `PATCH /api/board/[id]`                 | 수정 (작성자 본인)      | 10/분/IP   |
| `DELETE /api/board/[id]`                | 삭제 (작성자 본인)      | 5/분/IP    |
| `POST /api/board/[id]/comments`         | 댓글 작성               | 10/분/IP   |
| `DELETE /api/board/[id]/comments/[cid]` | 댓글 삭제 (본인)        | 10/분/IP   |
| `POST /api/board/[id]/report`           | 신고                    | 5/시간/IP  |
| `GET /api/admin/board/reports`          | 신고된 글 (관리자)      | ADMIN_KEY  |
| `DELETE /api/admin/board/[id]`          | 관리자 삭제             | ADMIN_KEY  |

작성자 본인 매칭: `request ipHash === post.ipHash`. nickname은 표시용일 뿐 권한 식별자가 아님 (스푸핑 가능).

## 5. UI

### 5.1 라우팅

새 탭 `board` 추가:

- `src/app/tabs/types.ts` — `Tab` 유니온에 `"board"` 추가
- `src/components/game/TabNavigation.tsx` — `SECONDARY_TABS`(마을)에 `{ id: "board", label: "게시판" }` 끼워넣기
- `src/components/game/TabContent.tsx` — `case "board"` 분기 추가

### 5.2 컴포넌트

`src/components/game/panels/BoardPanel.tsx` — 단일 컴포넌트로 시작:

```
┌──────────────────────────────┐
│  [게시판]   [+ 글쓰기]        │   header
├──────────────────────────────┤
│  ▶ 글 제목 1   닉네임 · 5분 전  │
│  ▶ 글 제목 2   닉네임 · 1시간 전│   list view
│  ...                         │
└──────────────────────────────┘
```

상세 진입 시 같은 패널이 detail view로 전환 (라우팅 X — 클라이언트 state 분기).

### 5.3 새 글 작성 모달

`src/components/modals/BoardComposeModal.tsx`:

- 제목 input (50자)
- 본문 textarea (2000자, 글자수 표시)
- 작성자 닉네임은 `state.character.name` 자동
- 제출 → `POST /api/board` → 성공 시 모달 닫고 목록 갱신

### 5.4 상세 + 댓글

같은 BoardPanel 내 detail 뷰:

- 제목·작성자·본문
- 댓글 리스트 (1단계)
- 댓글 입력 폼
- 본인 게시글이면 "수정" / "삭제" 버튼
- "신고" 버튼 (모든 사용자)

### 5.5 관리자 콘솔 확장 (별도 후속 PR로 분리 가능)

`src/app/admin/board/page.tsx` — 신고된 글 목록, 삭제 버튼.

## 6. 보안 / 안전장치

| 항목           | 처리                                                           |
| -------------- | -------------------------------------------------------------- |
| Rate-limit     | 채팅·피드백과 동일한 `rateLimit()` 패턴                        |
| 닉네임 검증    | 1~20자, trim, 공백만 X                                         |
| 길이 제한      | 제목 50, 본문 2000, 댓글 500자                                 |
| XSS            | UI에서 React 자동 escape, 본문 plain text 렌더 (마크다운 없음) |
| 본인 매칭      | IP 해시 (피드백과 동일 SHA256)                                 |
| KV 미설정 환경 | `hasKv()` 체크 → 503 + UI 비활성화 (채팅 패턴)                 |
| 관리자 인증    | 기존 `ADMIN_KEY` (피드백·grant와 동일)                         |

## 7. 구현 단계 (commit 분리)

각 단계 끝에 `tsc + eslint + next build` 통과 확인.

### Stage 1 — 백엔드 (types + storage + API)

- `src/lib/board/types.ts`, `src/lib/board/storage.ts` (KV helpers)
- `src/app/api/board/route.ts`, `[id]/route.ts`, `[id]/comments/route.ts`, `[id]/comments/[cid]/route.ts`, `[id]/report/route.ts`

### Stage 2 — UI (BoardPanel + 모달)

- `src/components/game/panels/BoardPanel.tsx` (list + detail 분기)
- `src/components/modals/BoardComposeModal.tsx`
- `src/app/tabs/types.ts` Tab 유니온 갱신
- `src/components/game/TabContent.tsx` 분기 추가
- `src/components/game/TabNavigation.tsx` 마을 메뉴에 "게시판" 추가

### Stage 3 — 관리자 콘솔 (선택)

- `src/app/admin/board/page.tsx`
- `src/app/api/admin/board/reports/route.ts`
- `src/app/api/admin/board/[id]/route.ts` (DELETE)

## 8. 검증

- 데이터 영속성: 새로고침 후 게시글 유지
- IP 본인 매칭: 다른 브라우저로 같은 닉네임 → 수정·삭제 차단
- Rate limit: 빠른 연속 작성 시 429 응답
- KV 미설정(local dev `KV_REST_API_URL` 없는 경우) → 503 + UI에 "게시판 비활성화" 안내
- XSS: 본문에 `<script>` 입력 → 그대로 텍스트 표시

## 9. 결정 항목 (구현 중 갱신)

- [ ] 카테고리 단일 vs 분리 (현재 안: 단일)
- [ ] 댓글 깊이 1단계 vs 대댓글 (현재 안: 1단계)
- [ ] 페이지네이션 vs 무한 스크롤 (MVP: 최신 N개만, 나중에 페이징)
- [ ] 관리자 큐 본 PR 포함 vs 후속 (현재 안: 본 PR Stage 3로 포함)
- [ ] 이미지 첨부 (현재 안: 후속, Vercel Blob 사용)

## 10. 진행 기록

- [x] Stage 1 — 백엔드 (types + storage + 5 API 라우트)
- [x] Stage 2 — UI (BoardPanel + 탭 통합)
- [x] Stage 3 — 관리자 콘솔 (/admin/board + 신고 큐 API)
