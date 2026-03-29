import { TrendRecord } from "../types.js";

function getSectionTitle(source: string): string {
  if (source.startsWith("x-ai")) return "X AI 热榜";
  if (source.startsWith("ai-article")) return "AI 技术文章";
  if (source.startsWith("hacker-news")) return "Hacker News 热榜";
  return "其他来源";
}

function groupRecords(records: TrendRecord[]): Array<[string, TrendRecord[]]> {
  const grouped = new Map<string, TrendRecord[]>();

  for (const record of records) {
    const section = getSectionTitle(record.source);
    const bucket = grouped.get(section) ?? [];
    bucket.push(record);
    grouped.set(section, bucket);
  }

  const preferredOrder = ["X AI 热榜", "AI 技术文章", "Hacker News 热榜", "其他来源"];
  return preferredOrder
    .filter((section) => grouped.has(section))
    .map((section) => [section, grouped.get(section) ?? []]);
}

export function toJson(records: TrendRecord[]): string {
  return JSON.stringify(records, null, 2);
}

export function toMarkdown(records: TrendRecord[]): string {
  const lines: string[] = ["# 多源 AI Radar", ""];

  if (records.length) {
    lines.push(`生成时间: ${records[0].fetchedAt}`);
    lines.push("");
  }

  for (const [section, sectionRecords] of groupRecords(records)) {
    lines.push(`## ${section}`);
    lines.push("");

    for (const record of sectionRecords) {
      lines.push(`### ${record.rank}. ${record.topic}`);
      lines.push(`- 来源: ${record.source}`);
      lines.push(`- 分类: ${record.category}`);
      lines.push(`- 热度分: ${record.heatScore}`);
      if (record.publishedAt) lines.push(`- 发布时间: ${record.publishedAt}`);
      lines.push(`- 中文摘要: ${record.summaryZh}`);
      lines.push(`- 英文摘要: ${record.summaryEn}`);
      lines.push(`- 标签: ${record.tags.join(", ") || "无"}`);
      if (record.url) lines.push(`- 链接: ${record.url}`);

      if (record.samplePosts.length) {
        lines.push("- 代表内容:");
        for (const post of record.samplePosts) {
          lines.push(`  - @${post.author}`);
          lines.push(`    - EN: ${post.textEn}`);
          lines.push(`    - ZH: ${post.textZh}`);
          if (post.url) lines.push(`    - URL: ${post.url}`);
        }
      }

      lines.push("");
    }
  }

  return lines.join("\n");
}
