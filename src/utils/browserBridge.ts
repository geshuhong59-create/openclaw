import { fetchJson } from "./http.js";

export interface BrowserBridgeTab {
  id: string;
  title: string;
  url: string;
  webSocketDebuggerUrl: string;
  blocked?: boolean;
}

interface BrowserBridgeOpenTabResponse {
  ok?: boolean;
  tab?: BrowserBridgeTab;
}

interface CdpCommandResult {
  result?: {
    value?: unknown;
    description?: string;
  };
  exceptionDetails?: {
    text?: string;
  };
}

class CdpPageSession {
  private readonly ws: WebSocket;
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }>();
  private readonly opened: Promise<void>;

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
    this.opened = new Promise((resolve, reject) => {
      this.ws.addEventListener("open", () => resolve(), { once: true });
      this.ws.addEventListener("error", (event) => reject(new Error(String(event))), { once: true });
    });

    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; error?: unknown; result?: unknown };
      if (!message.id) return;

      const pending = this.pending.get(message.id);
      if (!pending) return;

      this.pending.delete(message.id);

      if (message.error) {
        pending.reject(new Error(JSON.stringify(message.error)));
        return;
      }

      pending.resolve(message.result);
    });
  }

  async send<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    await this.opened;

    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async close(): Promise<void> {
    try {
      await this.send("Page.close");
    } catch {
      // Ignore close errors because the target may already be gone.
    }

    if (this.ws.readyState < WebSocket.CLOSING) {
      this.ws.close();
    }
  }
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, "");
}

export async function openBrowserBridgeTab(endpoint: string, url: string, timeoutMs: number): Promise<BrowserBridgeTab> {
  const payload = await fetchJson<BrowserBridgeOpenTabResponse>(
    `${normalizeEndpoint(endpoint)}/open-tab`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ url })
    },
    timeoutMs
  );

  if (!payload.tab?.webSocketDebuggerUrl) {
    throw new Error("Browser bridge returned no tab websocket");
  }

  return payload.tab;
}

export async function evaluateTabExpression<T>(webSocketDebuggerUrl: string, expression: string): Promise<T> {
  const session = new CdpPageSession(webSocketDebuggerUrl);

  try {
    await session.send("Page.enable");
    await session.send("Runtime.enable");

    const evaluation = await session.send<CdpCommandResult>("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });

    if (evaluation.exceptionDetails) {
      throw new Error(evaluation.exceptionDetails.text ?? evaluation.result?.description ?? "CDP evaluation failed");
    }

    return evaluation.result?.value as T;
  } finally {
    await session.close();
  }
}
