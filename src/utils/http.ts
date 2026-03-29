export function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function toIsoDate(value: string | number | Date | undefined): string | undefined {
  if (value === undefined) return undefined;

  const date =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value)
        : new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

async function fetchWithDefaults(url: string | URL, init: RequestInit = {}, timeoutMs = 20_000): Promise<Response> {
  const headers = new Headers({
    "user-agent": "openclaw-x-trends/0.1 (+https://github.com)",
    Accept: "application/json, text/plain, text/xml, application/xml;q=0.9, */*;q=0.8"
  });

  new Headers(init.headers ?? {}).forEach((value, key) => {
    headers.set(key, value);
  });

  return fetch(url, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(timeoutMs)
  });
}

export async function fetchJson<T>(url: string | URL, init: RequestInit = {}, timeoutMs = 20_000): Promise<T> {
  const response = await fetchWithDefaults(url, init, timeoutMs);

  if (!response.ok) {
    throw new Error(`Request failed for ${String(url)}: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export async function fetchText(url: string | URL, init: RequestInit = {}, timeoutMs = 20_000): Promise<string> {
  const response = await fetchWithDefaults(url, init, timeoutMs);

  if (!response.ok) {
    throw new Error(`Request failed for ${String(url)}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}
