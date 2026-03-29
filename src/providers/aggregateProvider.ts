import { RawTrendItem, TrendsProvider } from "../types.js";

function splitLimit(total: number, buckets: number): number[] {
  if (buckets <= 0) return [];

  const base = Math.floor(total / buckets);
  const remainder = total % buckets;

  return Array.from({ length: buckets }, (_, index) => base + (index < remainder ? 1 : 0));
}

export class AggregateProvider implements TrendsProvider {
  readonly name = "aggregate";

  constructor(private readonly providers: TrendsProvider[]) {}

  async fetchTrends(limit: number): Promise<RawTrendItem[]> {
    if (limit <= 0 || this.providers.length === 0) return [];

    const limits = splitLimit(limit, this.providers.length);
    const slack = Math.max(2, Math.ceil(limit / this.providers.length));
    const batches: RawTrendItem[][] = [];

    for (let index = 0; index < this.providers.length; index += 1) {
      const provider = this.providers[index];
      try {
        batches.push(await provider.fetchTrends(Math.min(limit, limits[index] + slack)));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[aggregate] ${provider.name} failed: ${message}`);
        batches.push([]);
      }
    }

    const selected: RawTrendItem[] = [];
    const extras: RawTrendItem[] = [];

    for (let index = 0; index < batches.length; index += 1) {
      const batch = batches[index];
      const guaranteed = limits[index] ?? 0;
      selected.push(...batch.slice(0, guaranteed));
      extras.push(...batch.slice(guaranteed));
    }

    if (selected.length < limit) {
      selected.push(...extras.slice(0, limit - selected.length));
    }

    return selected.slice(0, limit);
  }
}
