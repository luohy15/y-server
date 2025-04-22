// Cloudflare Worker specific types
export interface Env {
  // No environment variables needed as we use Bearer token
}

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}
