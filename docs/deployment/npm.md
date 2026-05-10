# npm Release

TokenCanvas 的 npm 包名是 `token-canvas`，可执行命令名是 `tokencanvas`。

## Package Modes

```bash
npm install -g token-canvas
tokencanvas
tokencanvas generate --prompt "a cinematic perfume bottle" --output-dir ./tokencanvas-output
tokencanvas web
```

- `tokencanvas`: 交互式 TUI。
- `tokencanvas generate`: 脚本友好的直接生成命令。
- `tokencanvas web`: 启动本机 Web UI，默认地址 `http://127.0.0.1:4174`。

## Pre-Publish Verification

```bash
npm view token-canvas
pnpm test
pnpm run typecheck:node
pnpm run build:package
pnpm run package:smoke
```

`npm view token-canvas` 在第一次发布前必须重新执行，因为 npm 包名可能随时被别人注册。404 表示当前未占用；已返回版本则说明不能用同名首次发布。

`package:smoke` 会执行：

- `npm pack --dry-run --json` 检查 packlist。
- 阻止测试、计划、solution 文档、本地 env 或输出目录进入 tarball。
- 真实 `npm pack` 后在临时目录安装。
- 运行 `tokencanvas --help` 验证安装后的 bin 可执行。
- 启动已安装包里的 `tokencanvas web`，请求首页和嵌套路由，验证打包后的 Web UI 可用。

## Trusted Publishing

推荐在 npm package settings 中配置 GitHub Actions trusted publisher：

- Repository: `PointMountain/gpt-generate-image`
- Workflow: `.github/workflows/npm-publish.yml`
- Package: `token-canvas`

发布 tag 后，workflow 使用 OIDC 执行：

```bash
npm publish --provenance --access public
```

不要使用长期 npm automation token，除非 trusted publishing 无法使用。
