# 개발 환경 정비 계획

> 코드 포맷·커밋 훅·에디터 설정을 표준화해 코드 일관성을 자동으로 유지하는 작업.
> 구현 항목 3개: **Prettier**, **Husky + lint-staged**, **VS Code 권장 설정**.

## 목적

- 손으로 신경 쓰지 않아도 같은 스타일로 통일
- PR/커밋 시 자동 lint/format
- 새 환경에서 git clone 후 즉시 권장 도구 안내

## 코드베이스 사전 점검

| 항목        | 현황                                             |
| ----------- | ------------------------------------------------ |
| 포매터      | 없음 (수동)                                      |
| 린터        | ESLint (`eslint-config-next`) — 동작 중          |
| Git 훅      | 없음                                             |
| `.vscode/`  | 없음                                             |
| 기존 스타일 | 더블 쿼트, 세미콜론, 후행 콤마 — TypeScript 기본 |

ESLint는 이미 정상 작동 중이고, 코드 스타일도 비교적 일관됨. Prettier가 들어오면 미세한 정렬·줄바꿈만 자동화되어 충돌 없음.

---

## 1. Prettier

### 1.1 의존성

```bash
npm install -D prettier eslint-config-prettier
```

- `prettier` — 포매터 본체
- `eslint-config-prettier` — Prettier와 충돌하는 ESLint 규칙 비활성화

### 1.2 설정 파일

**`.prettierrc.json`** (신규)

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "tabWidth": 2,
  "printWidth": 100,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

- 기존 코드 스타일 유지 (더블 쿼트, 세미콜론, 후행 콤마)
- `printWidth: 100`은 가독성과 너무 좁지 않은 균형
- `endOfLine: "lf"` — 운영체제 무관 일관성 (Vercel 빌드 안정)

**`.prettierignore`** (신규)

```
node_modules
.next
out
build
dist
package-lock.json
public/*.svg
.vercel
```

### 1.3 ESLint 충돌 방지

`eslint.config.mjs`에 prettier 비활성화 추가:

```ts
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier, // 마지막에 두어 충돌 규칙 disable
  globalIgnores([...]),
]);
```

### 1.4 npm 스크립트

`package.json`에 추가:

```json
"format": "prettier --write \"src/**/*.{ts,tsx,css,json,md}\" \"docs/**/*.md\" \"*.{json,md,ts,mjs}\"",
"format:check": "prettier --check \"src/**/*.{ts,tsx,css,json,md}\" \"docs/**/*.md\" \"*.{json,md,ts,mjs}\""
```

- `npm run format` — 전체 포맷 적용
- `npm run format:check` — CI/훅에서 검사용

### 1.5 첫 실행 (대규모 diff 발생 가능)

```bash
npm run format
```

→ 최초 1회는 다수 파일 변경 가능. 별도 PR로 분리 권장 (`chore: prettier 일괄 적용`).
이 PR 이후 git blame이 깨지지 않도록 `.git-blame-ignore-revs` 파일에 commit hash 기록.

---

## 2. Husky + lint-staged

### 2.1 의존성

```bash
npm install -D husky lint-staged
npx husky init
```

`husky init`이 자동으로:

- `.husky/pre-commit` 생성
- `package.json`에 `"prepare": "husky"` 추가

### 2.2 pre-commit 훅 설정

**`.husky/pre-commit`** (자동 생성됨, 수정)

```bash
npx lint-staged
```

기본 생성된 `npm test` 라인 제거 (현재 테스트 없음).

### 2.3 lint-staged 설정

`package.json`에 추가:

```json
"lint-staged": {
  "*.{ts,tsx}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{js,mjs,cjs,jsx}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{css,json,md}": [
    "prettier --write"
  ]
}
```

- `eslint --fix`: 자동 수정 가능한 lint 이슈 처리
- `prettier --write`: 포맷 적용
- 변경된 파일만 처리하므로 빠름

### 2.4 우회 규칙

훅 우회는 명확한 정당성이 있을 때만:

- 긴급 핫픽스: `git commit --no-verify` 후 즉시 후속 PR로 정리
- 자동 생성 파일: 해당 패턴을 lint-staged 매칭에서 제외
- 평소엔 절대 우회하지 않음

이 정책을 `CONTRIBUTING.md` 또는 `docs/operations.md`에 기록.

### 2.5 commit-msg 훅 (선택)

Conventional Commits 강제하고 싶다면 별도 `.husky/commit-msg`. 현재 권장 X (혼자 작업 + 한국어 커밋 메시지 사용).

---

## 3. VS Code 권장 설정

### 3.1 권장 확장

**`.vscode/extensions.json`** (신규)

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "Anthropic.claude-code",
    "yoavbls.pretty-ts-errors"
  ]
}
```

- ESLint, Prettier — 자동 인식 / 동작
- Tailwind CSS IntelliSense — class 자동완성, 호버 미리보기
- Claude Code — AI 보조
- pretty-ts-errors — TS 에러 가독성 향상

새 개발자가 워크스페이스 열면 "권장 확장 설치" 알림.

### 3.2 워크스페이스 설정

**`.vscode/settings.json`** (신규)

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[markdown]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "tailwindCSS.experimental.classRegex": [["className=\"([^\"]*)\""]],
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

- 저장 시 포맷 자동
- 저장 시 자동 수정 가능한 ESLint 이슈 fix
- 워크스페이스 TS 버전 사용 (CI와 일치)

### 3.3 launch.json (선택, 미도입)

Next.js 디버깅 설정. 필요 시점에 별도 추가.

---

## 도입 단계

| 순서     | 작업                                                 | 작업량    |
| -------- | ---------------------------------------------------- | --------- |
| 1        | Prettier 설치 + 설정 파일 (PR A)                     | 0.1일     |
| 2        | `npm run format` 일괄 적용 (PR B, blame ignore 기록) | 0.1일     |
| 3        | ESLint config에 prettier 추가                        | 0.05일    |
| 4        | Husky + lint-staged 설치 (PR C)                      | 0.2일     |
| 5        | `.vscode/extensions.json`, `settings.json` (PR D)    | 0.05일    |
| **합계** |                                                      | **0.5일** |

PR 분할 이유: prettier 일괄 적용은 diff가 커서 리뷰 어려움 → 단독 PR. 다른 변경과 섞이지 않게.

---

## 변경 파일 요약

| 파일                      | 종류                                          |
| ------------------------- | --------------------------------------------- |
| `.prettierrc.json`        | 신규                                          |
| `.prettierignore`         | 신규                                          |
| `eslint.config.mjs`       | 수정 (prettier 추가)                          |
| `.husky/pre-commit`       | 신규 (husky init이 생성 후 수정)              |
| `package.json`            | 수정 (deps + scripts + lint-staged + prepare) |
| `.git-blame-ignore-revs`  | 신규 (선택, prettier 일괄 적용 commit hash)   |
| `.vscode/extensions.json` | 신규                                          |
| `.vscode/settings.json`   | 신규                                          |

---

## 검증 체크리스트

### Prettier

- [ ] `npx prettier --check "src/**/*.{ts,tsx}"` 모두 통과
- [ ] `npm run format`으로 일괄 적용 후 diff 검토
- [ ] ESLint와 충돌 없는지 (`npx eslint .` 통과)

### Husky + lint-staged

- [ ] `git add` + `git commit` 시 훅 동작 (변경 파일만 lint/format)
- [ ] 의도적 lint 에러 만들면 commit 거부
- [ ] `--no-verify` 우회 동작 (정당한 경우만 사용)
- [ ] 새 clone 후 `npm install` 시 husky 자동 활성화 (`prepare` 스크립트)

### VS Code

- [ ] 새로 워크스페이스 열면 권장 확장 알림
- [ ] 저장 시 prettier 자동 적용
- [ ] 저장 시 eslint 자동 수정
- [ ] Tailwind className 자동완성

---

## 잠재 위험 / 대응

| 위험                                   | 대응                                                      |
| -------------------------------------- | --------------------------------------------------------- |
| 일괄 포맷 PR로 git blame 깨짐          | `.git-blame-ignore-revs`에 commit hash 기록               |
| 훅 너무 느림 (큰 PR 시)                | lint-staged는 변경 파일만 처리 — 보통 즉시                |
| Husky 설치 후 다른 환경에서 동작 안 함 | `npm install` 시 `prepare` 스크립트가 자동 활성화         |
| 너무 엄격한 lint 규칙으로 작업 멈춤    | `--fix`로 대부분 자동 수정. 안 되면 룰 완화               |
| Prettier vs 기존 코드 스타일 충돌      | 1회 일괄 적용 후 안정화. `.prettierrc.json`만 일관되면 OK |
| `eslint.config.mjs` flat config 호환성 | `eslint-config-prettier` 9+는 flat config 지원            |

---

## 도입 후 가이드

새 개발자 / 새 환경:

```bash
git clone <repo>
cd <repo>
npm install   # husky 자동 활성화
# VS Code 열면 권장 확장 알림 → 설치
# 코드 작성 → 저장 시 자동 포맷 + lint fix
# git commit → pre-commit이 변경 파일만 한 번 더 검사
```

수동 작업이 필요한 경우:

- `npm run format` — 전체 일괄 포맷
- `npm run lint` — eslint 검사
- `npm run format:check` — CI에서 포맷 누락 감지

CI(Vercel)는 별도 lint/format 검사를 강제하지 않음 — 로컬 훅으로 충분. 추후 GitHub Actions 도입 시 `format:check` 추가 가능.
