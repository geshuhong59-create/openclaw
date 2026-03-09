# X 热榜监控 MVP

这是一个面向 **二次开发** 的最小可用骨架：

- 抓取层：`provider`
- 标准化层：`normalize`
- 翻译层：`translator`
- 输出层：JSON / Markdown

当前默认使用 **mock provider**，不需要 API Key，就能直接跑通整条链路。
同时也预留了 **HTTP provider**，你后面只要填入真实接口地址和 key，就能切到真实数据源。

## 目录结构

```text
src/
  config.ts               # 基础配置
  index.ts                # 程序入口
  types.ts                # 统一类型定义
  core/normalize.ts       # 热榜标准化
  output/render.ts        # JSON / Markdown 输出
  providers/mockProvider.ts   # 模拟热榜数据源
  providers/httpProvider.ts   # 通用 HTTP API 适配器
  translation/mockTranslator.ts # 模拟翻译器
  translation/passthroughTranslator.ts # 透传翻译器
output/
  trends.json
  trends.md
```

## 快速开始

```bash
npm install
npm run dev
```

如果你要切到真实接口，先复制环境变量模板：

```bash
copy .env.example .env
```

运行后会生成：

- `output/trends.json`
- `output/trends.md`

## 现在这个骨架能做什么

- 模拟 X 全站热榜数据
- 输出统一结构化结果
- 为每条热点附带中文摘要
- 为代表帖子附带中英双语文本
- 方便后续接任何真实 API

## 怎么接入真实数据源

你现在已经可以直接用内置的 `httpProvider` 去接通用 JSON API。
如果后面你想做更细的字段适配，也可以继续新增 provider，比如：

- `src/providers/rapidapiProvider.ts`
- `src/providers/customScraperProvider.ts`
- `src/providers/officialApiProvider.ts`

它只要实现 `TrendsProvider` 接口：

```ts
export interface TrendsProvider {
  readonly name: string;
  fetchTrends(limit: number): Promise<RawTrendItem[]>;
}
```

然后在 `src/index.ts` 的 `createProvider()` 里注册即可。

## 怎么替换翻译模块

当前是 `MockTranslator`，后面你可以替换成：

- OpenAI
- DeepL
- Google Translate
- 你自己的 LLM 网关

只要实现：

```ts
export interface Translator {
  readonly name: string;
  translate(text: string): Promise<string>;
}
```

## 建议下一步

如果你要把它变成真正可用的工具，建议按这个顺序加：

1. 接真实 X 热榜 / 热门帖数据源
2. 增加去重、过滤、按领域分类
3. 增加 SQLite / Postgres 存储
4. 做热度变化追踪（上升 / 下降）
5. 增加定时任务和提醒输出
6. 再接 Web 面板 / Bot

## 环境变量

可选：

- `X_TRENDS_PROVIDER=mock | http`
- `X_TRENDS_LIMIT=10`
- `X_TRENDS_TRANSLATOR=mock | passthrough`
- `X_TRENDS_HTTP_ENDPOINT=...`
- `X_TRENDS_HTTP_API_KEY=...`
- `X_TRENDS_HTTP_API_HOST=...`

### HTTP provider 期望的响应格式

它默认会尝试读取下面这些字段之一：

- 顶层数组：`data` / `trends` / `items`
- 标题字段：`title` / `name` / `keyword`
- 热度字段：`score` / `heat` / `volume`
- 帖子数组：`posts`

也就是说，只要你的 API 大致长这样，就能先跑起来：

```json
{
  "data": [
    {
      "id": "1",
      "title": "OpenAI",
      "description": "OpenAI is trending globally",
      "score": 98,
      "url": "https://x.com/search?q=OpenAI",
      "tags": ["AI", "Global"],
      "posts": [
        {
          "author": "user1",
          "text": "OpenAI is everywhere today",
          "url": "https://x.com/..."
        }
      ]
    }
  ]
}
```

## 备注

这个仓库重点不是“直接拿来商用”，而是给你一个 **好改、好扩展、好接真实 API** 的基础骨架。
