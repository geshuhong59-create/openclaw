import { FeedSourceConfig } from "../config.js";
import { fetchText, toIsoDate } from "./http.js";
import { collapseWhitespace, decodeHtmlEntities, stripHtml } from "./text.js";

export interface ParsedFeedEntry {
  id: string;
  title: string;
  url?: string;
  description?: string;
  publishedAt?: string;
  tags: string[];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractTagValue(block: string, tagName: string): string | undefined {
  const pattern = new RegExp(`<${escapeRegex(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegex(tagName)}>`, "i");
  const match = block.match(pattern);
  if (!match) return undefined;

  return collapseWhitespace(
    decodeHtmlEntities(
      match[1]
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
        .replace(/^\s+|\s+$/g, "")
    )
  );
}

function extractTagValues(block: string, tagName: string): string[] {
  const pattern = new RegExp(`<${escapeRegex(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegex(tagName)}>`, "gi");
  return Array.from(block.matchAll(pattern))
    .map((match) => collapseWhitespace(decodeHtmlEntities(match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1"))))
    .filter(Boolean);
}

function extractAtomCategories(block: string): string[] {
  return Array.from(block.matchAll(/<category\b[^>]*term=["']([^"']+)["'][^>]*\/?>/gi))
    .map((match) => collapseWhitespace(decodeHtmlEntities(match[1])))
    .filter(Boolean);
}

function extractAtomLink(block: string): string | undefined {
  const alternate = block.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (alternate?.[1]) return collapseWhitespace(decodeHtmlEntities(alternate[1]));

  const fallback = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  return fallback?.[1] ? collapseWhitespace(decodeHtmlEntities(fallback[1])) : undefined;
}

function parseRss(xml: string): ParsedFeedEntry[] {
  return Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)).map((match, index) => {
    const block = match[0];
    const title = stripHtml(extractTagValue(block, "title") ?? `Feed item ${index + 1}`);
    const description = stripHtml(
      extractTagValue(block, "description") ??
        extractTagValue(block, "content:encoded") ??
        extractTagValue(block, "content") ??
        ""
    );
    const url = extractTagValue(block, "link") ?? extractTagValue(block, "guid");
    const publishedAt =
      toIsoDate(extractTagValue(block, "pubDate")) ??
      toIsoDate(extractTagValue(block, "dc:date")) ??
      toIsoDate(extractTagValue(block, "published"));
    const tags = extractTagValues(block, "category");

    return {
      id: extractTagValue(block, "guid") ?? url ?? `${title}-${index + 1}`,
      title,
      url,
      description: description || undefined,
      publishedAt,
      tags
    } satisfies ParsedFeedEntry;
  });
}

function parseAtom(xml: string): ParsedFeedEntry[] {
  return Array.from(xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)).map((match, index) => {
    const block = match[0];
    const title = stripHtml(extractTagValue(block, "title") ?? `Feed entry ${index + 1}`);
    const description = stripHtml(extractTagValue(block, "summary") ?? extractTagValue(block, "content") ?? "");
    const url = extractAtomLink(block) ?? extractTagValue(block, "id");
    const publishedAt = toIsoDate(extractTagValue(block, "published")) ?? toIsoDate(extractTagValue(block, "updated"));
    const tags = [...extractTagValues(block, "category"), ...extractAtomCategories(block)];

    return {
      id: extractTagValue(block, "id") ?? url ?? `${title}-${index + 1}`,
      title,
      url,
      description: description || undefined,
      publishedAt,
      tags
    } satisfies ParsedFeedEntry;
  });
}

export function parseFeed(xml: string): ParsedFeedEntry[] {
  const trimmed = xml.trim();
  if (trimmed.includes("<entry")) {
    return parseAtom(trimmed);
  }

  return parseRss(trimmed);
}

export async function loadFeedEntries(
  feed: FeedSourceConfig,
  limit: number,
  timeoutMs: number
): Promise<ParsedFeedEntry[]> {
  const xml = await fetchText(
    feed.url,
    {
      headers: {
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8"
      }
    },
    timeoutMs
  );

  return parseFeed(xml)
    .slice(0, limit)
    .map((entry) => ({
      ...entry,
      tags: Array.from(new Set([...feed.tags, ...entry.tags]))
    }));
}
