export interface AppConfig {
  provider: string;
  limit: number;
}

export function getConfig(): AppConfig {
  return {
    provider: process.env.X_TRENDS_PROVIDER ?? "mock",
    limit: Number(process.env.X_TRENDS_LIMIT ?? 10)
  };
}
