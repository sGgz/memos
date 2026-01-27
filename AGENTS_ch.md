# Memos 代码库 AI 代理指南

本文档为 AI 代理使用 Memos 代码库提供全面指导，涵盖架构、工作流程、约定和关键模式。

## 项目概述

Memos 是一个自托管的知识管理平台，构建于：
- **后端：** Go 1.25 配合 gRPC + Connect RPC
- **前端：** React 18.3 + TypeScript + Vite 7
- **数据库：** SQLite（默认）、MySQL、PostgreSQL
- **协议：** Protocol Buffers (v2) 配合 buf 进行代码生成
- **API 层：** 双协议 - Connect RPC（浏览器） + gRPC-Gateway（REST）

## 架构

### 后端架构

```
cmd/memos/              # 入口点
└── main.go             # Cobra CLI，配置文件设置，服务器初始化

server/
├── server.go           # Echo HTTP 服务器，healthz，后台运行器
├── auth/               # 身份验证（JWT、PAT、会话）
├── router/
│   ├── api/v1/        # gRPC 服务实现
│   │   ├── v1.go      # 服务注册，网关和 Connect 设置
│   │   ├── acl_config.go   # 公共端点白名单
│   │   ├── connect_services.go  # Connect RPC 处理器
│   │   ├── connect_interceptors.go # 身份验证、日志记录、恢复
│   │   └── *_service.go    # 各个服务（备忘录、用户等）
│   ├── frontend/       # 静态文件服务（SPA）
│   ├── fileserver/     # 用于媒体的原生 HTTP 文件服务
│   └── rss/           # RSS 源生成
└── runner/
    ├── memopayload/    # 备忘录负载处理（标签、链接、任务）
    └── s3presign/     # S3 预签名 URL 管理

store/                  # 带缓存的数据层
├── driver.go           # 驱动程序接口（数据库操作）
├── store.go           # 带缓存层的存储包装器
├── cache.go           # 内存缓存（实例设置、用户）
├── migrator.go        # 数据库迁移
├── db/
│   ├── db.go          # 驱动程序工厂
│   ├── sqlite/        # SQLite 实现
│   ├── mysql/         # MySQL 实现
│   └── postgres/      # PostgreSQL 实现
└── migration/         # SQL 迁移文件（嵌入式）

proto/                  # Protocol Buffer 定义
├── api/v1/           # API v1 服务定义
└── gen/               # 生成的 Go 和 TypeScript 代码
```

### 前端架构

```
web/
├── src/
│   ├── components/     # React 组件
│   ├── contexts/       # React Context（客户端状态）
│   │   ├── AuthContext.tsx      # 当前用户，身份验证状态
│   │   ├── ViewContext.tsx      # 布局，排序顺序
│   │   └── MemoFilterContext.tsx # 过滤器，快捷方式
│   ├── hooks/          # React Query 钩子（服务器状态）
│   │   ├── useMemoQueries.ts    # 备忘录 CRUD，分页
│   │   ├── useUserQueries.ts    # 用户操作
│   │   ├── useAttachmentQueries.ts # 附件操作
│   │   └── ...
│   ├── lib/            # 工具
│   │   ├── query-client.ts  # React Query v5 客户端
│   │   └── connect.ts       # Connect RPC 客户端设置
│   ├── pages/          # 页面组件
│   └── types/proto/    # 从 .proto 生成的 TypeScript
├── package.json        # 依赖项
└── vite.config.mts     # 带有开发代理的 Vite 配置

plugin/                 # 后端插件
├── scheduler/         # Cron 作业
├── email/            # 电子邮件投递
├── filter/           # CEL 过滤器表达式
├── webhook/          # Webhook 分发
├── markdown/         # Markdown 解析和渲染
├── httpgetter/        # HTTP 获取（元数据、图像）
└── storage/s3/       # S3 存储后端
```

## 关键架构模式

### 1. API 层：双协议

**Connect RPC（浏览器客户端）：**
- 协议：`connectrpc.com/connect`
- 基础路径：`/memos.api.v1.*`
- 拦截器链：元数据 → 日志记录 → 恢复 → 身份验证
- 向 React 前端返回类型安全的响应
- 参见：`server/router/api/v1/connect_interceptors.go:177-227`

**gRPC-Gateway（REST API）：**
- 协议：标准 HTTP/JSON
- 基础路径：`/api/v1/*`
- 使用与 Connect 相同的服务实现
- 适用于外部工具、CLI 客户端
- 参见：`server/router/api/v1/v1.go:52-96`

**身份验证：**
- JWT 访问令牌（V2）：无状态，15 分钟过期，通过 `AuthenticateByAccessTokenV2` 验证
- 个人访问令牌（PAT）：有状态，长期有效，针对数据库进行验证
- 两者都使用 `Authorization: Bearer <token>` 请求头
- 参见：`server/auth/authenticator.go:17-166`

### 2. 存储层：接口模式

所有数据库操作都通过 `Driver` 接口进行：
```go
type Driver interface {
    GetDB() *sql.DB
    Close() error

    IsInitialized(ctx context.Context) (bool, error)

    CreateMemo(ctx context.Context, create *Memo) (*Memo, error)
    ListMemos(ctx context.Context, find *FindMemo) ([]*Memo, error)
    UpdateMemo(ctx context.Context, update *UpdateMemo) error
    DeleteMemo(ctx context.Context, delete *DeleteMemo) error

    // ... 所有资源的类似方法
}
```

**三种实现：**
- `store/db/sqlite/` - SQLite (modernc.org/sqlite)
- `store/db/mysql/` - MySQL (go-sql-driver/mysql)
- `store/db/postgres/` - PostgreSQL (lib/pq)

**缓存策略：**
- 存储包装器维护以下内容的内存缓存：
   - 实例设置 (`instanceSettingCache`)
   - 用户 (`userCache`)
   - 用户设置 (`userSettingCache`)
- 配置：默认 TTL 10 分钟，清理间隔 5 分钟，最多 1000 个项目
- 参见：`store/store.go:10-57`

### 3. 前端状态管理

**React Query v5（服务器状态）：**
- 所有 API 调用都通过 `web/src/hooks/` 中的自定义钩子进行
- 查询键按资源组织：`memoKeys`、`userKeys`、`attachmentKeys`
- 默认 staleTime：30 秒，gcTime：5 分钟
- 窗口聚焦、重新连接时自动重新获取
- 参见：`web/src/lib/query-client.ts`

**React Context（客户端状态）：**
- `AuthContext`：当前用户，身份验证初始化，登出
- `ViewContext`：布局模式（LIST/MASONRY），排序顺序
- `MemoFilterContext`：活动过滤器，快捷方式选择，URL 同步

### 4. 数据库迁移系统

**迁移流程：**
1. `preMigrate`：检查数据库是否存在。如果不存在，应用 `LATEST.sql`
2. `checkMinimumUpgradeVersion`：拒绝 0.22 之前的安装
3. `applyMigrations`：在单个事务中应用增量迁移
4. 演示模式：使用演示数据填充

**模式版本控制：**
- 存储在 `system_setting` 表中
- 格式：`major.minor.patch`
- 迁移文件：`store/migration/{driver}/{version}/NN__description.sql`
- 参见：`store/migrator.go:21-414`

### 5. Protocol Buffer 代码生成

**定义位置：** `proto/api/v1/*.proto`

**重新生成：**
```bash
cd proto && buf generate
```

**生成输出：**
- Go：`proto/gen/api/v1/`（后端服务使用）
- TypeScript：`web/src/types/proto/api/v1/`（前端使用）

**代码检查：** `proto/buf.yaml` - BASIC 检查规则，FILE 破坏性变更

## 开发命令

### 后端

```bash
# 启动开发服务器
go run ./cmd/memos --port 8081

# 运行所有测试
go test ./...

# 运行特定包的测试
go test ./store/...
go test ./server/router/api/v1/test/...

# 代码检查（golangci-lint）
golangci-lint run

# 格式化导入
goimports -w .

# 使用 MySQL/Postgres 运行
DRIVER=mysql go run ./cmd/memos
DRIVER=postgres go run ./cmd/memos
```

### 前端

```bash
# 安装依赖项
cd web && pnpm install

# 启动开发服务器（将 API 代理到 localhost:8081）
pnpm dev

# 类型检查
pnpm lint

# 自动修复代码检查问题
pnpm lint:fix

# 格式化代码
pnpm format

# 为生产环境构建
pnpm build

# 构建并复制到后端
pnpm release
```

### Protocol Buffers

```bash
# 从 .proto 文件重新生成 Go 和 TypeScript
cd proto && buf generate

# 检查 proto 文件
cd proto && buf lint

# 检查破坏性变更
cd proto && buf breaking --against .git#main
```

## 关键工作流程

### 添加新的 API 端点

1. **在 Protocol Buffer 中定义：**
   - 编辑 `proto/api/v1/*_service.proto`
   - 添加请求/响应消息
   - 向服务添加 RPC 方法

2. **重新生成代码：**
   ```bash
   cd proto && buf generate
   ```

3. **实现服务（后端）：**
   - 向 `server/router/api/v1/*_service.go` 添加方法
   - 遵循现有模式：获取用户、验证、调用存储
   - 向 `server/router/api/v1/connect_services.go` 添加 Connect 包装器（可选，相同实现）

4. **如果是公共端点：**
   - 添加到 `server/router/api/v1/acl_config.go:11-34`

5. **创建前端钩子（如果需要）：**
   - 向 `web/src/hooks/use*Queries.ts` 添加查询/变更
   - 使用现有的查询键工厂

### 数据库模式变更

1. **创建迁移文件：**
   ```
   store/migration/sqlite/0.28/1__add_new_column.sql
   store/migration/mysql/0.28/1__add_new_column.sql
   store/migration/postgres/0.28/1__add_new_column.sql
   ```

2. **更新 LATEST.sql：**
   - 将变更添加到 `store/migration/{driver}/LATEST.sql`

3. **更新存储接口（如果是新表/模型）：**
   - 向 `store/driver.go:8-71` 添加方法
   - 在 `store/db/{driver}/*.go` 中实现

4. **测试迁移：**
   - 运行 `go test ./store/test/...` 进行验证

### 添加新的前端页面

1. **创建页面组件：**
   - 添加到 `web/src/pages/NewPage.tsx`
   - 使用现有钩子进行数据获取

2. **添加路由：**
   - 编辑 `web/src/App.tsx`（或路由器配置）

3. **使用 React Query：**
   ```typescript
   import { useMemos } from "@/hooks/useMemoQueries";
   const { data, isLoading } = useMemos({ filter: "..." });
   ```

4. **使用 Context 处理客户端状态：**
   ```typescript
   import { useView } from "@/contexts/ViewContext";
   const { layout, toggleSortOrder } = useView();
   ```

## 测试

### 后端测试

**测试模式：**
```go
func TestMemoCreation(t *testing.T) {
    ctx := context.Background()
    store := test.NewTestingStore(ctx, t)

    // 创建测试用户
    user, _ := createTestUser(ctx, store, t)

    // 执行操作
    memo, err := store.CreateMemo(ctx, &store.Memo{
        CreatorID: user.ID,
        Content:  "Test memo",
        // ...
    })
    require.NoError(t, err)
    assert.NotNil(t, memo)
}
```

**测试工具：**
- `store/test/store.go:22-35` - `NewTestingStore()` 创建隔离的数据库
- `store/test/store.go:37-77` - `resetTestingDB()` 清理表
- 测试数据库由 `DRIVER` 环境变量决定（默认：sqlite）

**运行测试：**
```bash
# 所有测试
go test ./...

# 特定包
go test ./store/...
go test ./server/router/api/v1/test/...

# 带覆盖率
go test -cover ./...
```

### 前端测试

**TypeScript 检查：**
```bash
cd web && pnpm lint
```

**无自动化测试：**
- 前端依赖于 TypeScript 检查和手动验证
- React Query DevTools 在开发模式下可用（左下角）

## 代码约定

### Go

**错误处理：**
- 使用 `github.com/pkg/errors` 进行包装：`errors.Wrap(err, "context")`
- 返回结构化的 gRPC 错误：`status.Errorf(codes.NotFound, "message")`

**命名：**
- 包名：小写，单个单词（例如：`store`、`server`）
- 接口：`Driver`、`Store`、`Service`
- 方法：导出的使用 PascalCase，内部的使用 camelCase

**注释：**
- 公共导出的函数必须有注释（godot 强制执行）
- 单行使用 `//`，多行使用 `/* */`

**导入：**
- 分组：标准库、第三方、本地
- 组内按字母顺序排序
- 使用 `goimports -w .` 进行格式化

### TypeScript/React

**组件：**
- 使用钩子的函数式组件
- 使用 `useMemo`、`useCallback` 进行优化
- 属性接口：`interface Props { ... }`

**状态管理：**
- 服务器状态：React Query 钩子
- 客户端状态：React Context
- 避免对服务器数据直接使用 useState

**样式：**
- 通过 `@tailwindcss/vite` 使用 Tailwind CSS v4
- 使用 `clsx` 和 `tailwind-merge` 处理条件类

**导入：**
- 使用 `@/` 别名的绝对导入
- 分组：React、第三方、本地
- 由 Biome 自动组织

## 重要文件参考

### 后端入口点

| 文件 | 用途 |
|------|---------|
| `cmd/memos/main.go` | 服务器入口点，CLI 设置 |
| `server/server.go` | Echo 服务器初始化，后台运行器 |
| `store/store.go` | 带缓存的存储包装器 |
| `store/driver.go` | 数据库驱动程序接口 |

### API 层

| 文件 | 用途 |
|------|---------|
| `server/router/api/v1/v1.go` | 服务注册，网关设置 |
| `server/router/api/v1/acl_config.go` | 公共端点白名单 |
| `server/router/api/v1/connect_interceptors.go` | Connect 拦截器 |
| `server/auth/authenticator.go` | 身份验证逻辑 |

### 前端核心

| 文件 | 用途 |
|------|---------|
| `web/src/lib/query-client.ts` | React Query 客户端配置 |
| `web/src/contexts/AuthContext.tsx` | 用户身份验证状态 |
| `web/src/contexts/ViewContext.tsx` | UI 偏好设置 |
| `web/src/contexts/MemoFilterContext.tsx` | 过滤器状态 |
| `web/src/hooks/useMemoQueries.ts` | 备忘录查询/变更 |

### 数据层

| 文件 | 用途 |
|------|---------|
| `store/memo.go` | 备忘录模型定义，存储方法 |
| `store/user.go` | 用户模型定义 |
| `store/attachment.go` | 附件模型定义 |
| `store/migrator.go` | 迁移逻辑 |
| `store/db/db.go` | 驱动程序工厂 |
| `store/db/sqlite/sqlite.go` | SQLite 驱动程序实现 |

## 配置

### 后端环境变量

| 变量 | 默认值 | 描述 |
|----------|----------|-------------|
| `MEMOS_DEMO` | `false` | 启用演示模式 |
| `MEMOS_PORT` | `8081` | HTTP 端口 |
| `MEMOS_ADDR` | `` | 绑定地址（空 = 全部） |
| `MEMOS_DATA` | `~/.memos` | 数据目录 |
| `MEMOS_DRIVER` | `sqlite` | 数据库：`sqlite`、`mysql`、`postgres` |
| `MEMOS_DSN` | `` | 数据库连接字符串 |
| `MEMOS_INSTANCE_URL` | `` | 实例基础 URL |

### 前端环境变量

| 变量 | 默认值 | 描述 |
|----------|----------|-------------|
| `DEV_PROXY_SERVER` | `http://localhost:8081` | 后端代理目标 |

## CI/CD

### GitHub 工作流

**后端测试** (`.github/workflows/backend-tests.yml`):
- 在 `go.mod`、`go.sum`、`**.go` 文件变更时运行
- 步骤: 验证 `go mod tidy`、golangci-lint、所有测试

**前端测试** (`.github/workflows/frontend-tests.yml`):
- 在 `web/**` 目录变更时运行
- 步骤: pnpm install、代码检查、构建

**Proto 代码检查** (`.github/workflows/proto-linter.yml`):
- 在 `.proto` 文件变更时运行
- 步骤: buf lint、buf breaking check

### 代码检查配置

**Go** (`.golangci.yaml`):
- 检查器: revive、govet、staticcheck、misspell、gocritic 等
- 格式化工具: goimports
- 禁止使用: `fmt.Errorf`、`ioutil.ReadDir`

**TypeScript** (`web/biome.json`):
- 代码检查: Biome (替代 ESLint)
- 代码格式化: Biome (替代 Prettier)
- 行宽: 140 字符
- 分号: 始终使用

## 常见任务

### 调试 API 问题

1.  检查 Connect 拦截器日志: `server/router/api/v1/connect_interceptors.go:79-105`
2.  如果端点是公开的，请验证其是否在 `acl_config.go` 中
3.  通过 `auth/authenticator.go:133-165` 检查身份验证
4.  使用 curl 测试: `curl -H "Authorization: Bearer <token>" http://localhost:8081/api/v1/...`

### 调试前端状态

1.  打开 React Query DevTools (开发模式下在左下角)
2.  检查查询缓存、变更、重新获取行为
3.  通过 React DevTools 检查 Context 状态
4.  在 MemoFilterContext 中验证过滤器状态

### 针对多个数据库运行测试

```bash
# SQLite (默认)
DRIVER=sqlite go test ./...

# MySQL (需要运行 MySQL 服务器)
DRIVER=mysql DSN="user:pass@tcp(localhost:3306)/memos" go test ./...

# PostgreSQL (需要运行 PostgreSQL 服务器)
DRIVER=postgres DSN="postgres://user:pass@localhost:5432/memos" go test ./...
```

## 插件系统

后端在 `plugin/` 目录下支持可插拔组件:

| 插件 | 用途 |
|--------|----------|
| `scheduler` | 基于 Cron 的作业调度 |
| `email` | SMTP 邮件发送 |
| `filter` | CEL 表达式过滤 |
| `webhook` | HTTP Webhook 分发 |
| `markdown` | Markdown 解析 (goldmark) |
| `httpgetter` | HTTP 内容获取 |
| `storage/s3` | S3 兼容存储 |

每个插件都有自己的 README 文件，其中包含使用示例。

## 性能考量

### 后端

- 数据库查询使用分页 (`limit`、`offset`)
- 内存缓存减少对频繁访问数据的数据库请求
- SQLite 使用 WAL 日志模式 (减少锁定)
- 缩略图生成限制为 3 个并发操作

### 前端

- React Query 减少冗余的 API 调用
- 大型列表使用无限查询 (分页)
- 手动代码分割: `utils-vendor`、`mermaid-vendor`、`leaflet-vendor`
- 重量级组件使用懒加载

## 安全说明

- JWT 密钥必须保密 (在生产模式下首次运行时生成)
- 个人访问令牌以 SHA-256 哈希形式存储在数据库中
- 通过 SameSite Cookie 提供 CSRF 保护
- 为所有来源启用 CORS (生产环境需配置)
- 在服务层进行输入验证
- 通过参数化查询防止 SQL 注入