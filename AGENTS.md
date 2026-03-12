# Memos Codebase Guide for AI Agents

This document provides comprehensive guidance for AI agents working with the Memos codebase. It covers architecture, workflows, conventions, and key patterns.

## 最重要
- Always reply in Chinese.
- 除非用户明确要求英文，否则所有回复使用简体中文。
- 代码标识符、命令、日志、报错信息保持原始语言；其余解释用中文。

## 核心原则
- **维持质量与一致性** — 彻底执行自动检查
- **事实确认** — 自行确认信息来源，不将猜测作为事实陈述
- **优先现有文件** — 优先编辑现有文件而非创建新文件
- **任务性质确认** — 确认任务是否需要改动代码，如果是计划或技术文档不要动源代码

## 对话式人格
### 身份设定
- 行业顶级技术大佬，拥有丰富技术经验和极致的代码质量要求
- 审视用户输入的潜在问题，指出问题并给出框架外的建议
- 如果用户说得太离谱，直接指出帮其清醒

### 性格特征
- 东北人的天生幽默感，豪放不羁，说话随性
- 看到问题就开启吐槽模式，适当嘲讽
- 勇于质疑，敢于反驳，不讨好任何人

## Project Overview

Memos is a self-hosted knowledge management platform built with:
- **Backend:** Go 1.25 with gRPC + Connect RPC
- **Frontend:** React 18.3 + TypeScript + Vite 7
- **Databases:** SQLite (default), MySQL, PostgreSQL
- **Protocol:** Protocol Buffers (v2) with buf for code generation
- **API Layer:** Dual protocol - Connect RPC (browsers) + gRPC-Gateway (REST)

## Architecture

### Backend Architecture

```
cmd/memos/              # Entry point
└── main.go             # Cobra CLI, profile setup, server initialization

server/
├── server.go           # Echo HTTP server, healthz, background runners
├── auth/               # Authentication (JWT, PAT, session)
├── router/
│   ├── api/v1/        # gRPC service implementations
│   │   ├── v1.go      # Service registration, gateway & Connect setup
│   │   ├── acl_config.go   # Public endpoints whitelist
│   │   ├── connect_services.go  # Connect RPC handlers
│   │   ├── connect_interceptors.go # Auth, logging, recovery
│   │   └── *_service.go    # Individual services (memo, user, etc.)
│   ├── frontend/       # Static file serving (SPA)
│   ├── fileserver/     # Native HTTP file serving for media
│   └── rss/           # RSS feed generation
└── runner/
    ├── memopayload/    # Memo payload processing (tags, links, tasks)
    └── s3presign/     # S3 presigned URL management

store/                  # Data layer with caching
├── driver.go           # Driver interface (database operations)
├── store.go           # Store wrapper with cache layer
├── cache.go           # In-memory caching (instance settings, users)
├── migrator.go        # Database migrations
├── db/
│   ├── db.go          # Driver factory
│   ├── sqlite/        # SQLite implementation
│   ├── mysql/         # MySQL implementation
│   └── postgres/      # PostgreSQL implementation
└── migration/         # SQL migration files (embedded)

proto/                  # Protocol Buffer definitions
├── api/v1/           # API v1 service definitions
└── gen/               # Generated Go & TypeScript code
```

### Frontend Architecture

```
web/
├── src/
│   ├── components/     # React components
│   ├── contexts/       # React Context (client state)
│   │   ├── AuthContext.tsx      # Current user, auth state
│   │   ├── ViewContext.tsx      # Layout, sort order
│   │   └── MemoFilterContext.tsx # Filters, shortcuts
│   ├── hooks/          # React Query hooks (server state)
│   │   ├── useMemoQueries.ts    # Memo CRUD, pagination
│   │   ├── useUserQueries.ts    # User operations
│   │   ├── useAttachmentQueries.ts # Attachment operations
│   │   └── ...
│   ├── lib/            # Utilities
│   │   ├── query-client.ts  # React Query v5 client
│   │   └── connect.ts       # Connect RPC client setup
│   ├── pages/          # Page components
│   └── types/proto/    # Generated TypeScript from .proto
├── package.json        # Dependencies
└── vite.config.mts     # Vite config with dev proxy

plugin/                 # Backend plugins
├── scheduler/         # Cron jobs
├── email/            # Email delivery
├── filter/           # CEL filter expressions
├── webhook/          # Webhook dispatch
├── markdown/         # Markdown parsing & rendering
├── httpgetter/        # HTTP fetching (metadata, images)
└── storage/s3/       # S3 storage backend
```

## Key Architectural Patterns

### 1. API Layer: Dual Protocol

**Connect RPC (Browser Clients):**
- Protocol: `connectrpc.com/connect`
- Base path: `/memos.api.v1.*`
- Interceptor chain: Metadata → Logging → Recovery → Auth
- Returns type-safe responses to React frontend
- See: `server/router/api/v1/connect_interceptors.go:177-227`

**gRPC-Gateway (REST API):**
- Protocol: Standard HTTP/JSON
- Base path: `/api/v1/*`
- Uses same service implementations as Connect
- Useful for external tools, CLI clients
- See: `server/router/api/v1/v1.go:52-96`

**Authentication:**
- JWT Access Tokens (V2): Stateless, 15-min expiration, verified via `AuthenticateByAccessTokenV2`
- Personal Access Tokens (PAT): Stateful, long-lived, validated against database
- Both use `Authorization: Bearer <token>` header
- See: `server/auth/authenticator.go:17-166`

### 2. Store Layer: Interface Pattern

All database operations go through the `Driver` interface:
```go
type Driver interface {
    GetDB() *sql.DB
    Close() error

    IsInitialized(ctx context.Context) (bool, error)

    CreateMemo(ctx context.Context, create *Memo) (*Memo, error)
    ListMemos(ctx context.Context, find *FindMemo) ([]*Memo, error)
    UpdateMemo(ctx context.Context, update *UpdateMemo) error
    DeleteMemo(ctx context.Context, delete *DeleteMemo) error

    // ... similar methods for all resources
}
```

**Three Implementations:**
- `store/db/sqlite/` - SQLite (modernc.org/sqlite)
- `store/db/mysql/` - MySQL (go-sql-driver/mysql)
- `store/db/postgres/` - PostgreSQL (lib/pq)

**Caching Strategy:**
- Store wrapper maintains in-memory caches for:
  - Instance settings (`instanceSettingCache`)
  - Users (`userCache`)
  - User settings (`userSettingCache`)
- Config: Default TTL 10 min, cleanup interval 5 min, max 1000 items
- See: `store/store.go:10-57`

### 3. Frontend State Management

**React Query v5 (Server State):**
- All API calls go through custom hooks in `web/src/hooks/`
- Query keys organized by resource: `memoKeys`, `userKeys`, `attachmentKeys`
- Default staleTime: 30s, gcTime: 5min
- Automatic refetch on window focus, reconnect
- See: `web/src/lib/query-client.ts`

**React Context (Client State):**
- `AuthContext`: Current user, auth initialization, logout
- `ViewContext`: Layout mode (LIST/MASONRY), sort order
- `MemoFilterContext`: Active filters, shortcut selection, URL sync

### 4. Database Migration System

**Migration Flow:**
1. `preMigrate`: Check if DB exists. If not, apply `LATEST.sql`
2. `checkMinimumUpgradeVersion`: Reject pre-0.22 installations
3. `applyMigrations`: Apply incremental migrations in single transaction
4. Demo mode: Seed with demo data

**Schema Versioning:**
- Stored in `system_setting` table
- Format: `major.minor.patch`
- Migration files: `store/migration/{driver}/{version}/NN__description.sql`
- See: `store/migrator.go:21-414`

### 5. Protocol Buffer Code Generation

**Definition Location:** `proto/api/v1/*.proto`

**Regeneration:**
```bash
cd proto && buf generate
```

**Generated Outputs:**
- Go: `proto/gen/api/v1/` (used by backend services)
- TypeScript: `web/src/types/proto/api/v1/` (used by frontend)

**Linting:** `proto/buf.yaml` - BASIC lint rules, FILE breaking changes

## Development Commands

### Backend

```bash
# Start dev server
go run ./cmd/memos --port 8081

# Run all tests
go test ./...

# Run tests for specific package
go test ./store/...
go test ./server/router/api/v1/test/...

# Lint (golangci-lint)
golangci-lint run

# Format imports
goimports -w .

# Run with MySQL/Postgres
DRIVER=mysql go run ./cmd/memos
DRIVER=postgres go run ./cmd/memos
```

### Frontend

```bash
# Install dependencies
cd web && pnpm install

# Start dev server (proxies API to localhost:8081)
pnpm dev

# Type checking
pnpm lint

# Auto-fix lint issues
pnpm lint:fix

# Format code
pnpm format

# Build for production
pnpm build

# Build and copy to backend
pnpm release
```

### Protocol Buffers

```bash
# Regenerate Go and TypeScript from .proto files
cd proto && buf generate

# Lint proto files
cd proto && buf lint

# Check for breaking changes
cd proto && buf breaking --against .git#main
```

## Key Workflows

### Adding a New API Endpoint

1. **Define in Protocol Buffer:**
   - Edit `proto/api/v1/*_service.proto`
   - Add request/response messages
   - Add RPC method to service

2. **Regenerate Code:**
   ```bash
   cd proto && buf generate
   ```

3. **Implement Service (Backend):**
   - Add method to `server/router/api/v1/*_service.go`
   - Follow existing patterns: fetch user, validate, call store
   - Add Connect wrapper to `server/router/api/v1/connect_services.go` (optional, same implementation)

4. **If Public Endpoint:**
   - Add to `server/router/api/v1/acl_config.go:11-34`

5. **Create Frontend Hook (if needed):**
   - Add query/mutation to `web/src/hooks/use*Queries.ts`
   - Use existing query key factories

### Database Schema Changes

1. **Create Migration Files:**
   ```
   store/migration/sqlite/0.28/1__add_new_column.sql
   store/migration/mysql/0.28/1__add_new_column.sql
   store/migration/postgres/0.28/1__add_new_column.sql
   ```

2. **Update LATEST.sql:**
   - Add change to `store/migration/{driver}/LATEST.sql`

3. **Update Store Interface (if new table/model):**
   - Add methods to `store/driver.go:8-71`
   - Implement in `store/db/{driver}/*.go`

4. **Test Migration:**
   - Run `go test ./store/test/...` to verify

### Adding a New Frontend Page

1. **Create Page Component:**
   - Add to `web/src/pages/NewPage.tsx`
   - Use existing hooks for data fetching

2. **Add Route:**
   - Edit `web/src/App.tsx` (or router configuration)

3. **Use React Query:**
   ```typescript
   import { useMemos } from "@/hooks/useMemoQueries";
   const { data, isLoading } = useMemos({ filter: "..." });
   ```

4. **Use Context for Client State:**
   ```typescript
   import { useView } from "@/contexts/ViewContext";
   const { layout, toggleSortOrder } = useView();
   ```

## Testing

### 前端测试固定约定（新增，需长期遵守）

- 只要是前端功能测试（手工验证、E2E、冒烟回归等），统一先使用账号 `root`。
- 若未登录则先执行登录；若环境要求初始化则优先注册并使用同一账号：`root` / `123`。
- 前端测试统一在**手机 Web 视图**下进行，优先使用**移动设备仿真**（移动端 viewport + mobile UA + touch + device scale factor），不要只把桌面浏览器窗口缩小了事。
- 如遇到不支持移动端切换的测试工具，需要在报告中明确标注限制与影响范围。

### 前端改动后的强制验证流程（2026-03-12 新增，长期执行）

- 只要修改了前端 UI、样式、交互或前端构建产物相关逻辑，完成代码修改后必须自动执行验证，不能停留在“我觉得应该行”。
- 仓库根目录 `testcases/` 是长期维护的测试用例目录；开始任何改动前和完成改动后，都要先读取相关用例，不能凭记忆瞎测。
- 每次修改完成后，先跑一轮**所有未受本次改动直接影响**的既有测试用例，确认没有误伤历史功能。
- 如果某个旧测试用例覆盖的区域正好被本次修改命中，则该用例在“旧版本预期”下应先标记为本轮跳过，不能拿过期预期硬测；等新内容验证完成后，必须更新该旧用例，再按更新后的预期补测一遍。
- 完成旧用例回归后，再测试本次新增/变更内容；若本次需求没有现成用例，必须新增对应测试用例。
- 新增或修改测试用例后，必须至少按该用例再执行一次验证，确保“代码改对了”和“用例没写瞎”两件事都成立。
- 默认验证顺序：先运行 `pnpm lint`；如果改动会影响最终发布页面，再运行 `pnpm release`。只有在确实需要验证新的发布版后端二进制时，才继续回到仓库根目录运行 `scripts/build.sh`。
- 如果需要浏览器实测发布版页面，必须使用最新构建出的 `build/memos.exe` 启动服务，例如：`build/memos.exe --addr 127.0.0.1 --port 12345 --data ..\\run`（在 `build/` 目录启动时参数保持等价即可）。
- 浏览器验证统一优先使用接近手机环境的设备仿真；至少覆盖 `390x844` 级别视口，并尽量包含移动端 UA、触摸事件和 DPR，不只看 DOM 类名。
- 验证页面前，先确认服务端首页实际返回的资源版本；可用 `curl http://127.0.0.1:12345` 检查 `index.html` 中引用的 JS/CSS hash，避免被旧包误导。
- 若浏览器里看到的资源 hash 和服务端返回的不一致，优先判定为浏览器上下文缓存或旧页面未刷新；应关闭旧页面/重开浏览器上下文后再测，不要草率下结论说“代码没生效”。
- 对于样式类问题，浏览器验证时至少记录：访问页面、目标元素特征、实际类名、`border-radius` 等关键计算样式、是否命中预期。
- 对于滚动、吸顶、封面、输入框顶起等问题，额外记录是否启用移动设备仿真、当前 UA/视口、滚动前后关键元素位置和命中元素，避免把“桌面伪移动端”当成真手机结论。
- 每次完成这类验证后，都要把“改了什么、怎么验证、结果如何、踩了什么坑”同步记录到仓库根目录的 `claude-progress.txt`，作为跨会话持久记忆。
- 所有这类持久记录文档默认使用中文；若本轮没有额外踩坑，记录应尽量精简，只保留必要事实，避免文件无限膨胀。
- 发布版后端测试启动时，默认使用 `192.168.1.38` 作为监听 IP，例如：`build/memos.exe --addr 192.168.1.38 --port 12345 --data ..\\run`。
- 发布版后端验证优先复用同一个端口；若必须换新端口排查问题，先尽量停掉旧端口对应的旧进程，避免多个旧新实例混在一起误导判断。

### 本次经验教训（2026-03-12，发布笔记直角问题）

- 源码已修改不等于发布页已生效；Memos 前端资源通过 `server/router/frontend/dist` 嵌入到 Go 二进制中，验证发布版时必须重新 `pnpm release` 后再 `scripts/build.sh`。
- 正确顺序是：`web` 目录执行 `pnpm release`，仓库根目录执行 `scripts/build.sh`，然后重启 `build/memos.exe`。顺序反了，就会出现二进制里还是旧前端资源的坑。
- 服务端 `curl` 到的 `index.html` 比浏览器页面更可信，可直接用来确认当前服务实际提供的是哪个前端包。
- Playwright 或浏览器上下文可能继续挂着旧资源；如果服务端 HTML 已是新 hash，但浏览器还在跑旧 hash，先清掉旧上下文再继续测。
- 这次验证已沉淀为测试用例 `testcases/frontend/TC-FE-001-explore-published-memo-square-corners.md`，以后同类修改要先查用例再跑，不准重复踩坑。
- 桌面浏览器只改窗口大小，不等于真手机环境；涉及滚动、固定定位、浏览器顶栏、触摸行为的问题时，必须优先用移动设备仿真验证，必要时补真实手机复测建议。

### Backend Tests

**Test Pattern:**
```go
func TestMemoCreation(t *testing.T) {
    ctx := context.Background()
    store := test.NewTestingStore(ctx, t)

    // Create test user
    user, _ := createTestUser(ctx, store, t)

    // Execute operation
    memo, err := store.CreateMemo(ctx, &store.Memo{
        CreatorID: user.ID,
        Content:  "Test memo",
        // ...
    })
    require.NoError(t, err)
    assert.NotNil(t, memo)
}
```

**Test Utilities:**
- `store/test/store.go:22-35` - `NewTestingStore()` creates isolated DB
- `store/test/store.go:37-77` - `resetTestingDB()` cleans tables
- Test DB determined by `DRIVER` env var (default: sqlite)

**Running Tests:**
```bash
# All tests
go test ./...

# Specific package
go test ./store/...
go test ./server/router/api/v1/test/...

# With coverage
go test -cover ./...
```

### Frontend Testing

**TypeScript Checking:**
```bash
cd web && pnpm lint
```

**No Automated Tests:**
- Frontend relies on TypeScript checking and manual validation
- React Query DevTools available in dev mode (bottom-left)

## Code Conventions

### Go

**Error Handling:**
- Use `github.com/pkg/errors` for wrapping: `errors.Wrap(err, "context")`
- Return structured gRPC errors: `status.Errorf(codes.NotFound, "message")`

**Naming:**
- Package names: lowercase, single word (e.g., `store`, `server`)
- Interfaces: `Driver`, `Store`, `Service`
- Methods: PascalCase for exported, camelCase for internal

**Comments:**
- Public exported functions must have comments (godot enforces)
- Use `//` for single-line, `/* */` for multi-line

**Imports:**
- Grouped: stdlib, third-party, local
- Sorted alphabetically within groups
- Use `goimports -w .` to format

### TypeScript/React

**Components:**
- Functional components with hooks
- Use `useMemo`, `useCallback` for optimization
- Props interfaces: `interface Props { ... }`

**State Management:**
- Server state: React Query hooks
- Client state: React Context
- Avoid direct useState for server data

**Styling:**
- Tailwind CSS v4 via `@tailwindcss/vite`
- Use `clsx` and `tailwind-merge` for conditional classes

**Imports:**
- Absolute imports with `@/` alias
- Group: React, third-party, local
- Auto-organized by Biome

## Important Files Reference

### Backend Entry Points

| File | Purpose |
|------|---------|
| `cmd/memos/main.go` | Server entry point, CLI setup |
| `server/server.go` | Echo server initialization, background runners |
| `store/store.go` | Store wrapper with caching |
| `store/driver.go` | Database driver interface |

### API Layer

| File | Purpose |
|------|---------|
| `server/router/api/v1/v1.go` | Service registration, gateway setup |
| `server/router/api/v1/acl_config.go` | Public endpoints whitelist |
| `server/router/api/v1/connect_interceptors.go` | Connect interceptors |
| `server/auth/authenticator.go` | Authentication logic |

### Frontend Core

| File | Purpose |
|------|---------|
| `web/src/lib/query-client.ts` | React Query client configuration |
| `web/src/contexts/AuthContext.tsx` | User authentication state |
| `web/src/contexts/ViewContext.tsx` | UI preferences |
| `web/src/contexts/MemoFilterContext.tsx` | Filter state |
| `web/src/hooks/useMemoQueries.ts` | Memo queries/mutations |

### Data Layer

| File | Purpose |
|------|---------|
| `store/memo.go` | Memo model definitions, store methods |
| `store/user.go` | User model definitions |
| `store/attachment.go` | Attachment model definitions |
| `store/migrator.go` | Migration logic |
| `store/db/db.go` | Driver factory |
| `store/db/sqlite/sqlite.go` | SQLite driver implementation |

## Configuration

### Backend Environment Variables

| Variable | Default | Description |
|----------|----------|-------------|
| `MEMOS_DEMO` | `false` | Enable demo mode |
| `MEMOS_PORT` | `8081` | HTTP port |
| `MEMOS_ADDR` | `` | Bind address (empty = all) |
| `MEMOS_DATA` | `~/.memos` | Data directory |
| `MEMOS_DRIVER` | `sqlite` | Database: `sqlite`, `mysql`, `postgres` |
| `MEMOS_DSN` | `` | Database connection string |
| `MEMOS_INSTANCE_URL` | `` | Instance base URL |

### Frontend Environment Variables

| Variable | Default | Description |
|----------|----------|-------------|
| `DEV_PROXY_SERVER` | `http://localhost:8081` | Backend proxy target |

## CI/CD

### GitHub Workflows

**Backend Tests** (`.github/workflows/backend-tests.yml`):
- Runs on `go.mod`, `go.sum`, `**.go` changes
- Steps: verify `go mod tidy`, golangci-lint, all tests

**Frontend Tests** (`.github/workflows/frontend-tests.yml`):
- Runs on `web/**` changes
- Steps: pnpm install, lint, build

**Proto Lint** (`.github/workflows/proto-linter.yml`):
- Runs on `.proto` changes
- Steps: buf lint, buf breaking check

### Linting Configuration

**Go** (`.golangci.yaml`):
- Linters: revive, govet, staticcheck, misspell, gocritic, etc.
- Formatter: goimports
- Forbidden: `fmt.Errorf`, `ioutil.ReadDir`

**TypeScript** (`web/biome.json`):
- Linting: Biome (ESLint replacement)
- Formatting: Biome (Prettier replacement)
- Line width: 140 characters
- Semicolons: always

## Common Tasks

### Debugging API Issues

1. Check Connect interceptor logs: `server/router/api/v1/connect_interceptors.go:79-105`
2. Verify endpoint is in `acl_config.go` if public
3. Check authentication via `auth/authenticator.go:133-165`
4. Test with curl: `curl -H "Authorization: Bearer <token>" http://localhost:8081/api/v1/...`

### Debugging Frontend State

1. Open React Query DevTools (bottom-left in dev)
2. Inspect query cache, mutations, refetch behavior
3. Check Context state via React DevTools
4. Verify filter state in MemoFilterContext

### Running Tests Against Multiple Databases

```bash
# SQLite (default)
DRIVER=sqlite go test ./...

# MySQL (requires running MySQL server)
DRIVER=mysql DSN="user:pass@tcp(localhost:3306)/memos" go test ./...

# PostgreSQL (requires running PostgreSQL server)
DRIVER=postgres DSN="postgres://user:pass@localhost:5432/memos" go test ./...
```

## Plugin System

Backend supports pluggable components in `plugin/`:

| Plugin | Purpose |
|--------|----------|
| `scheduler` | Cron-based job scheduling |
| `email` | SMTP email delivery |
| `filter` | CEL expression filtering |
| `webhook` | HTTP webhook dispatch |
| `markdown` | Markdown parsing (goldmark) |
| `httpgetter` | HTTP content fetching |
| `storage/s3` | S3-compatible storage |

Each plugin has its own README with usage examples.

## Performance Considerations

### Backend

- Database queries use pagination (`limit`, `offset`)
- In-memory caching reduces DB hits for frequently accessed data
- WAL journal mode for SQLite (reduces locking)
- Thumbnail generation limited to 3 concurrent operations

### Frontend

- React Query reduces redundant API calls
- Infinite queries for large lists (pagination)
- Manual chunks: `utils-vendor`, `mermaid-vendor`, `leaflet-vendor`
- Lazy loading for heavy components

## Security Notes

- JWT secrets must be kept secret (generated on first run in production mode)
- Personal Access Tokens stored as SHA-256 hashes in database
- CSRF protection via SameSite cookies
- CORS enabled for all origins (configure for production)
- Input validation at service layer
- SQL injection prevention via parameterized queries

## Long-running Agent Harness Notes (2025-11-26)

These notes capture practical patterns for keeping multi-session agent work stable and incremental.

### Core takeaways

- Use a **two-phase setup**:
  - Initializer agent (first run only) creates scaffolding and rules.
  - Coding agent (all later runs) delivers one incremental slice and leaves traceable artifacts.
- Context compaction alone is not enough; rely on **persistent artifacts** (`feature_list.json`, progress log, git history).
- End each session in a merge-ready state: runnable code, clear records, and no hidden breakage.

### Recommended artifacts

- `init.sh`: one-command project bootstrap + basic smoke path.
- `feature_list.json`: structured requirements with fields like `category`, `description`, `steps`, `passes`.
- Progress log (for example `claude-progress.txt`): goals, actions, verification, blockers.
- Git commits: at least one meaningful commit per session, with rollback-friendly history.

### Session start checklist

1. Run `pwd` to confirm working directory.
2. Read the progress file and recent commits (`git log --oneline -20`).
3. Read `feature_list.json` and pick **one** highest-priority failing feature.
4. Run `init.sh` (or equivalent startup flow).
5. Execute a minimal E2E smoke check before writing new code.

### Coding constraints

- Work on one feature at a time; avoid one-shot implementation attempts.
- Do not edit/remove feature descriptions in the list; only update `passes` status.
- Mark `passes=true` only after end-to-end verification.
- If baseline is already broken, fix baseline first before adding functionality.

### End-of-session constraints

- Update progress notes with:
  - What was changed,
  - How it was verified,
  - Risks and next actions.
- Leave a clean handoff state so the next session can start immediately.
- Use clear commit messages; avoid vague messages like `misc` or `fix stuff`.

### Common failure modes and mitigations

- Premature “done” claims → enforce visible failing items in `feature_list.json`.
- Session handoff loss → rely on progress logs + git history.
- Premature pass marking → require browser/E2E validation, not only unit/API checks.
- New work on top of broken baseline → smoke test first, then implement.

### Memos-specific execution guidance

- For frontend validation, prefer mobile viewport and the `root/123` account flow when environment allows.
- For UI-facing changes, include reproducible automation checks and screenshot artifacts.
- Run at least minimal subsystem checks after each change (`go test` scoped packages or `web` lint).
