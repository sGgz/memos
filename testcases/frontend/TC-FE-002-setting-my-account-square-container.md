# TC-FE-002 个人信息界面外层容器为直角

- 类型：发布验证 / 样式回归
- 覆盖范围：`Setting` 页面 `#my-account` 分区外层主容器；当前实现位于 `web/src/pages/Setting.tsx`
- 跳过条件：若本次改动直接修改了设置页主容器结构、类名、布局包装层或 `my-account` 分区容器逻辑，则本用例先跳过旧预期回归，待新需求验证完成后更新本用例再补测

## 前置条件

- 已完成前端改动代码提交到工作区
- 已在 `web/` 运行 `pnpm lint`
- 若验证发布版：已按顺序执行 `pnpm release` -> 仓库根目录 `scripts/build.sh`
- 已按 `scripts/all_build.sh` 约定启动发布版服务，例如：仓库根目录执行 `bash scripts/all_build.sh -s`；其等价手动命令是在 `build/` 目录执行 `./memos --addr 192.168.1.38 --port 12345 --data ..\\run`（Windows 下对应 `memos.exe`）
- 准备浏览器手机视口 `390x844`
- 测试账号：`root / 123`

## 执行步骤

1. 访问 `http://192.168.1.38:12345`。
2. 若未登录，则使用 `root / 123` 登录。
3. 用 `curl http://192.168.1.38:12345` 检查首页 HTML，确认引用的是当前最新构建产物的 JS/CSS hash。
4. 在浏览器打开 `http://192.168.1.38:12345/setting#my-account`。
5. 定位设置页主内容外层容器（特征：包住“我的账号”“账号信息”“访问令牌”等内容的带边框背景容器）。
6. 记录该元素实际类名。
7. 检查该元素计算样式，重点记录 `border-radius`。

## 预期结果

- 服务端返回的首页资源 hash 与当前构建产物一致。
- 浏览器实际加载的是最新 hash 对应的资源，而不是旧资源。
- 设置页 `my-account` 主容器不包含圆角类名；当前期望类名可为 `w-full border border-border flex flex-row justify-start items-start px-4 py-3 bg-background text-muted-foreground`。
- 目标元素计算样式 `border-radius` 为 `0px`。
- 页面在手机视口下显示正常，没有因为容器改为直角导致内容溢出、标题错位或操作按钮错乱。

## 维护说明

- 若后续设置页主容器抽成共享组件或共享 class，只要最终计算样式仍为直角，可更新“当前期望类名”描述，但必须保留“检查计算样式”的要求。
- 若浏览器资源和服务端首页 hash 不一致，优先重开浏览器上下文后再测。
