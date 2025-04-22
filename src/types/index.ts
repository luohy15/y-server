// Cloudflare Worker specific types
export interface Env {
  // No environment variables needed as we use Bearer token
  DEFAULT_API_KEY: string;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}
