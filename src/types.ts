export interface RawTrendItem {
  id: string;
  title: string;
  url?: string;
  description?: string;
  posts?: RawPost[];
  score?: number;
  tags?: string[];
  source?: string;
}

export interface RawPost {
  author: string;
  text: string;
  url?: string;
  engagement?: {
    likes?: number;
    reposts?: number;
    replies?: number;
  };
}

export interface TrendRecord {
  rank: number;
  topic: string;
  summaryEn: string;
  summaryZh: string;
  heatScore: number;
  category: string;
  source: string;
  url?: string;
  tags: string[];
  samplePosts: TrendPost[];
  fetchedAt: string;
}

export interface TrendPost {
  author: string;
  textEn: string;
  textZh: string;
  url?: string;
}

export interface TrendsProvider {
  readonly name: string;
  fetchTrends(limit: number): Promise<RawTrendItem[]>;
}

export interface Translator {
  readonly name: string;
  translate(text: string): Promise<string>;
}
