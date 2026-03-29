import { RawTrendItem, TrendPost, TrendRecord, Translator } from "../types.js";

function guessCategory(item: RawTrendItem): string {
  const source = (item.source ?? "").toLowerCase();
  const joined = `${source} ${(item.tags ?? []).join(" ")}`.toLowerCase();

  if (source.startsWith("x-ai")) return "X AI 热榜";
  if (source.startsWith("ai-article")) return "AI 技术文章";
  if (source.startsWith("hacker-news")) return "Hacker News 热榜";
  if (joined.includes("ai")) return "AI";
  if (joined.includes("market")) return "市场";
  if (joined.includes("hardware")) return "硬件";
  if (joined.includes("startup") || joined.includes("launch")) return "创业";
  return "综合";
}

async function normalizePosts(posts: RawTrendItem["posts"], translator: Translator): Promise<TrendPost[]> {
  if (!posts?.length) return [];

  return Promise.all(
    posts.slice(0, 3).map(async (post) => ({
      author: post.author,
      textEn: post.text,
      textZh: await translator.translate(post.text),
      url: post.url
    }))
  );
}

export async function normalizeTrends(items: RawTrendItem[], translator: Translator): Promise<TrendRecord[]> {
  const fetchedAt = new Date().toISOString();

  return Promise.all(
    items.map(async (item, index) => {
      const summaryEn = item.description ?? item.posts?.[0]?.text ?? item.title;
      return {
        rank: index + 1,
        topic: item.title,
        summaryEn,
        summaryZh: await translator.translate(summaryEn),
        heatScore: item.score ?? 0,
        category: guessCategory(item),
        source: item.source ?? "unknown",
        url: item.url,
        tags: item.tags ?? [],
        samplePosts: await normalizePosts(item.posts, translator),
        fetchedAt,
        publishedAt: item.publishedAt
      } satisfies TrendRecord;
    })
  );
}
