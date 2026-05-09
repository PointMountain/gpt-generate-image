# GPT Image Workbench

浏览器版的个人 AI 产图工作台，直接使用 OpenAI 和 AI SDK。

## 当前能力

- 保存 OpenAI API key、模型和默认参数到浏览器本地
- 使用 AI SDK `generateImage()` 调用 OpenAI 图片模型
- 支持文生图、单图/多图参考图和上传 mask 的遮罩编辑
- 支持 size、count、quality、background、output format、output compression
- 自定义兼容端点需要填写完整 HTTPS baseURL；如果端点按 OpenAI `/v1` 路径组织，请在 baseURL 中保留 `/v1`
- 当前结果支持预览、下载、复用为参考图
- 本地历史记录与预设模板

## 本地约束

- 凭证只保存在当前浏览器本地
- 首发版本不带服务端代理，不支持多人共享
- 如果要公开部署或多人使用，应另做后端代理和服务端密钥管理
- mask 编辑首版只支持上传 mask 文件，不内置画笔或图层
- 请通过 `npm run dev` 或 `npm run preview` 运行，不要直接双击 `index.html`

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

## 后续适合追加的方向

- 后端 API route 代理和服务端密钥管理
- 内置 mask 绘制器
- Responses API 多轮图片工作流
- 更丰富的结果筛选与批量复用
