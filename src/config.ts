export interface AppConfig {
  provider: string;
  limit: number;
  translator: string;
  httpEndpoint?: string;
  httpApiKey?: string;
  httpApiHost?: string;
}

export function getConfig(): AppConfig {
  return {
    provider: process.env.X_TRENDS_PROVIDER ?? "mock",
    limit: Number(process.env.X_TRENDS_LIMIT ?? 10),
    translator: process.env.X_TRENDS_TRANSLATOR ?? "mock",
    httpEndpoint: process.env.X_TRENDS_HTTP_ENDPOINT,
    httpApiKey: process.env.X_TRENDS_HTTP_API_KEY,
    httpApiHost: process.env.X_TRENDS_HTTP_API_HOST
  };
}
