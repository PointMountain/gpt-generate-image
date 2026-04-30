# GPT Image Workbench

浏览器版的个人 AI 产图工作台，面向第三方 OpenAI-compatible provider。

## 当前能力

- 保存多个 `baseURL + apiKey` provider 配置到浏览器本地
- 自动拉取 `/v1/models`，并标出疑似 image 模型
- 标准模式失败后，可通过最小兼容回退面板继续接第三方 provider
- 支持文生图与参考图模式
- 当前结果支持预览、下载、复用为参考图
- 本地历史记录与预设模板
- 本地代理模式，可在开发环境下绕过浏览器对第三方 provider 的 CORS 限制

## 本地约束

- 凭证只保存在当前浏览器本地
- 首发版本不带服务端代理，不支持多人共享
- 如果 provider 拦截浏览器跨域请求，页面仍会失败；这类 provider 后续更适合包一层桌面壳或本地代理
- 请通过 `npm run dev` 或 `npm run preview` 运行，不要直接双击 `index.html`
- `通过本地代理转发请求` 只在 `npm run dev` 下可用；它依赖 Vite 本地开发服务上的 `/__proxy`

## 启动

```bash
npm install
npm run dev
```

默认地址：

```text
http://127.0.0.1:5173
```

## 测试与构建

```bash
npm test
npm run build
npm run test:e2e
```

## 兼容回退字段

首版只开放最小必要字段，不提供通用请求编辑器：

- 手动模型名
- 跳过模型发现
- 图片端点覆盖
- 额外 headers
- 额外 query
- 参考图支持开关
- 返回模式切换

## 后续适合追加的方向

- 桌面壳封装，绕开部分浏览器跨域限制
- provider 连接模板
- 更丰富的结果筛选与批量复用
- 局部编辑 / 重绘能力
