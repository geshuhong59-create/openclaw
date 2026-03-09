# X 热榜监控 MVP

这是一个面向 **二次开发** 的最小可用骨架：

- 抓取层：`provider`
- 标准化层：`normalize`
- 翻译层：`translator`
- 输出层：JSON / Markdown

当前默认使用 **mock provider**，不需要 API Key，就能直接跑通整条链路。

## 目录结构

```text
src/
  config.ts               # 基础配置
  index.ts                # 程序入口
  types.ts                # 统一类型定义
  core/normalize.ts       # 热榜标准化
  output/render.ts        # JSON / Markdown 输出
  providers/mockProvider.ts   # 模拟热榜数据源
  translation/mockTranslator.ts # 模拟翻译器
output/
  trends.json
  trends.md
```

## 快速开始

```bash
npm install
npm run dev
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

你后面只需要新增一个 provider，比如：

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

- `X_TRENDS_PROVIDER=mock`
- `X_TRENDS_LIMIT=10`

## 备注

这个仓库重点不是“直接拿来商用”，而是给你一个 **好改、好扩展、好接真实 API** 的基础骨架。
