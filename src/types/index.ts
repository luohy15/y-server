// Cloudflare Worker specific types
export interface Env {
  // No environment variables needed as we use Bearer token
  DEFAULT_API_KEY: string;
  // R2 bucket for storing images
  CDN_BUCKET: R2Bucket;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}
