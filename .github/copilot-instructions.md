# Copilot Instructions for Memos

## Build, Test, and Lint Commands
### Backend (Go)
- **Environment:** Go 1.25, default driver is SQLite (override with `DRIVER` env and `DSN` for MySQL/Postgres).
- **Dev server:** `go run ./cmd/memos --port 8081`
- **All tests:** `go test ./...`
- **Package-specific:** `go test ./store/...` (covers all drivers via store/test harness) or `go test ./server/...`
- **Single test:** `go test ./store/... -run TestMemoCreation`
- **Static checks:** `go mod tidy -go=1.25 && git diff --exit-code`, `golangci-lint run`
- **Formatting:** `goimports -w .`

### Frontend (React/TypeScript, pnpm 9 + Node 20)
- `cd web && pnpm install`
- **Dev server:** `pnpm dev` (proxies API to `http://localhost:8081`)
- **Lint/type-check:** `pnpm lint` (Biome)
- **Auto-fix:** `pnpm lint:fix`
- **Format:** `pnpm format`
- **Build:** `pnpm build`
- **Bundle for backend release:** `pnpm release`

### Protocol Buffers (buf)
- `cd proto && buf generate` (Go + TypeScript stubs)
- `cd proto && buf lint`
- `cd proto && buf breaking --against .git#main`
- `buf format -d` must be clean in CI.

## High-Level Architecture
- **Backend entry point (`cmd/memos/main.go`)** sets up Cobra CLI, config/profile handling, and boots the Echo HTTP server (`server/server.go`) plus background runners.
- **API layer (`server/router/api/v1/`)** exposes both Connect RPC (`/memos.api.v1.*`) and gRPC-Gateway REST (`/api/v1/*`). Shared interceptors enforce metadata logging, recovery, and authentication (JWT v2 + PAT). Public endpoints must be whitelisted in `acl_config.go`.
- **Service implementations** call into the **store layer** (`store/`) which wraps DB drivers (`sqlite`, `mysql`, `postgres`) behind `Driver` interfaces and adds in-memory caches for instance settings/users/user settings (TTL 10m, cleanup 5m, max 1000).
- **Runners (`server/runner/*`)** handle background work like memo payload enrichment and S3 presign lifecycle.
- **Plugins (`plugin/`)** provide optional modules (scheduler, email, filter, webhook, markdown, httpgetter, storage/s3); each subdir is a standalone package wired via plugin registries.
- **Frontend (`web/`)** is React 18 + Vite: React Query hooks in `web/src/hooks` handle server state, contexts (`AuthContext`, `ViewContext`, `MemoFilterContext`) track client state, and utilities in `web/src/lib` configure the Connect client and query client. Types are generated under `web/src/types/proto`.
- **Proto contracts** live in `proto/api/v1/*.proto`; generated Go code feeds server services, TS code feeds frontend hooks. CI enforces lint + breaking checks.

## Key Conventions
- **API/service flow:** Validate auth via `auth/authenticator.go`, run request validation, call store methods, and return typed protobuf responses. Public unauthenticated routes must be registered in `acl_config.go`.
- **Error handling:** Wrap internal errors with `github.com/pkg/errors` and expose gRPC status errors (`status.Errorf(...)`). Avoid `fmt.Errorf` per repo linting rules.
- **Store patterns:** Use the `Driver` interface for all DB access; keep caching coherent by invalidating caches in store methods when mutating underlying data. Database migrations live under `store/migration/{driver}/{version}` plus `LATEST.sql`; changing schema requires touching all drivers and updating the migrator.
- **Frontend data access:** Prefer existing React Query hooks (e.g., `useMemoQueries`, `useUserQueries`, `useAttachmentQueries`) and extend their key factories instead of raw fetch calls. Client state toggles belong in contexts to keep UI synchronized (layout/filter shortcuts, etc.).
- **Styling/imports:** Tailwind CSS v4 via `@tailwindcss/vite`, `clsx`, and `tailwind-merge`. Absolute imports use the `@/` alias. Biome controls linting + formatting (line width 140, always semicolons).
- **Testing strategy:** `store/test` harness spins up SQLite/MySQL/Postgres via Testcontainers; leave `DRIVER` unset to test all drivers, or set `DRIVER=sqlite` for faster local runs. Server/plugins use `go test -race` where possible.
- **CI expectations:** Changes touching Go code must keep `go mod tidy` clean and pass golangci-lint + matrix tests; frontend changes must pass `pnpm lint` and `pnpm build`; proto changes must keep `buf lint`/`buf breaking` happy.

