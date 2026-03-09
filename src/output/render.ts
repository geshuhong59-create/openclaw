import { TrendRecord } from "../types.js";

export function toJson(records: TrendRecord[]): string {
  return JSON.stringify(records, null, 2);
}

export function toMarkdown(records: TrendRecord[]): string {
  const lines: string[] = ["# X 全站热榜（MVP 示例）", ""];

  for (const record of records) {
    lines.push(`## ${record.rank}. ${record.topic}`);
    lines.push(`- 分类：${record.category}`);
    lines.push(`- 热度分：${record.heatScore}`);
    lines.push(`- 中文摘要：${record.summaryZh}`);
    lines.push(`- 英文摘要：${record.summaryEn}`);
    lines.push(`- 标签：${record.tags.join(", ") || "无"}`);
    if (record.url) lines.push(`- 链接：${record.url}`);
    if (record.samplePosts.length) {
      lines.push(`- 代表内容：`);
      for (const post of record.samplePosts) {
        lines.push(`  - @${post.author}`);
        lines.push(`    - EN: ${post.textEn}`);
        lines.push(`    - ZH: ${post.textZh}`);
        if (post.url) lines.push(`    - URL: ${post.url}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
