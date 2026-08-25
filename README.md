# taichung-planner

Project: `taichung-planner`
GitHub: https://github.com/dev-hoonizm/taichung-planner.git

2026년 9월 타이중 2박 3일 여행 중 휴대폰에서 사용하는 개인 대시보드입니다. 정적 `public/index.html`은 오프라인 캐시를 우선 표시하고, Cloudflare Workers Static Assets와 D1을 통해 여러 기기에서 일정 상태·체크리스트·회화 즐겨찾기·음식 기록·예산·지출·메모를 동기화합니다.

## Architecture

```text
Browser → Cloudflare Worker → API router → Cloudflare D1
                         ↘ Static Assets
           ↘ localStorage offline cache
```

- D1 binding: `DB`
- D1 database: `taichung-planner-db`
- API authentication secret: `TRIP_API_KEY`
- Framework/build server: 없음

## Cloudflare Workers 설정

Cloudflare Dashboard에서 Worker `taichung-planner`의 Builds에 GitHub 저장소 `dev-hoonizm/taichung-planner`와 production branch `main`을 연결합니다. `wrangler.jsonc`가 배포 설정의 source of truth입니다.

| 항목 | 값 |
|---|---|
| Build command | 비워 두기 |
| Deploy command | `npx wrangler deploy` |
| Root directory | 저장소 루트 |

`src/worker.js`가 API 요청을 처리하고 `public/`은 정적 자산으로 배포됩니다.

## D1 생성 및 연결

Dashboard에서 **Storage & Databases → D1 → Create Database**를 선택하고 아래 이름으로 생성합니다.

```text
taichung-planner-db
```

Worker `taichung-planner`의 D1 binding은 `wrangler.jsonc`에서 다음 이름으로 연결합니다.

```text
Variable name: DB
Database: taichung-planner-db
```

`database_id`에는 Dashboard 또는 `npx wrangler d1 info taichung-planner-db`에서 확인한 실제 ID를 사용합니다.

## Schema 적용

먼저 Cloudflare에 로그인합니다.

```bash
npx wrangler login
```

Production D1에 스키마를 적용합니다.

```bash
npx wrangler d1 execute taichung-planner-db --remote --file=./schema.sql
```

로컬 D1은 production과 별도입니다. 로컬 개발용 스키마는 다음처럼 적용합니다.

```bash
npx wrangler d1 execute taichung-planner-db --local --file=./schema.sql
```

`--remote`를 생략하거나 `--local`과 혼동하지 마세요. 실제 서비스 데이터베이스 변경에는 반드시 `--remote`를 명시합니다.

## API 인증 설정

Cloudflare Worker의 **Settings → Variables and Secrets**에서 `TRIP_API_KEY`를 secret으로 추가합니다. 값은 이 저장소나 README에 기록하지 않습니다.

로컬 개발에서는 선택적으로 `.dev.vars`를 만들 수 있습니다.

```dotenv
TRIP_API_KEY="your-local-only-value"
```

`.dev.vars`, `.env`, API key 및 기타 비밀 파일은 `.gitignore`에 포함되어 있습니다. `TRIP_API_KEY`가 없으면 로컬 개발 편의를 위해 인증 없이 동작하고 Functions 콘솔에 경고가 출력됩니다.

브라우저에서는 Cloud Sync의 **PIN 설정**에 같은 값을 최초 한 번 입력합니다. 이후 API 요청은 `X-Trip-Key` 헤더를 사용하며 key 자체는 서버 응답이나 소스에 포함되지 않습니다.

## 로컬 개발

`wrangler.jsonc`의 database ID를 실제 ID로 교체한 뒤 로컬 D1 스키마를 적용하고 실행합니다.

```bash
npx wrangler d1 execute taichung-planner-db --local --file=./schema.sql
npx wrangler dev
```

기본 주소는 `http://localhost:8787`입니다. 정적 화면만 확인하려면 `public/index.html`을 직접 열어도 되며, 이 경우 API 연결은 Offline으로 표시되고 localStorage 캐시는 계속 동작합니다.

서버 함수의 인증·validation·prepared binding 단위 테스트는 다음 명령으로 실행합니다.

```bash
npm test
```

## API

모든 응답은 JSON이며 성공 시 `{ "success": true, "data": ... }`, 실패 시 `{ "success": false, "error": "..." }` 형식입니다.

| Method | Route | 설명 |
|---|---|---|
| GET | `/api/health` | D1 연결 확인 |
| GET | `/api/state` | 전체 앱 상태 조회 |
| PUT | `/api/state` | key 단위 JSON 상태 UPSERT |
| GET | `/api/expenses` | 최신순 지출 조회 |
| POST | `/api/expenses` | 지출 추가 |
| DELETE | `/api/expenses?id=123` | 지출 삭제 |
| GET | `/api/memo` | 여행 메모 조회 |
| PUT | `/api/memo` | singleton 여행 메모 저장 |

인증이 설정되어 있으면 모든 요청에 아래 헤더가 필요합니다.

```http
X-Trip-Key: <TRIP_API_KEY>
```

## Offline sync

1. localStorage 캐시로 UI를 즉시 렌더링합니다.
2. 서버 데이터가 있으면 D1을 source of truth로 적용하고 로컬 캐시도 갱신합니다.
3. 서버 데이터가 비어 있고 기존 로컬 데이터가 있으면 최초 한 번 D1로 마이그레이션합니다.
4. 네트워크 저장 실패는 `localStorage.pendingSync`에 쌓입니다.
5. 브라우저의 `online` 이벤트가 발생하면 pending queue를 자동 재전송합니다.

## 자동 배포

GitHub 저장소가 Cloudflare Workers Builds에 연결된 뒤 `main`에 push하면 자동으로 새 배포를 시작합니다.

```text
Codex 수정 → Git commit → GitHub push → Cloudflare Workers 자동 배포
→ Worker API / Static Assets → D1
```

배포 후 확인:

```text
https://taichung-planner.<account-subdomain>.workers.dev/
https://taichung-planner.<account-subdomain>.workers.dev/api/health
```
