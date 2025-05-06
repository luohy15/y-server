// Cloudflare Worker specific types
export interface Env {
  // Cloudflare account id for Browser Rendering
  CLOUDFLARE_ACCOUNT_ID: string;
  // Cloudflare api token for Browser Rendering
  CLOUDFLARE_BROWSER_RENDER_API_TOKEN: string;
  // R2 bucket for storing images
  CDN_BUCKET: R2Bucket;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}
