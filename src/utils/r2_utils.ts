/**
 * Utility functions for Cloudflare R2 operations
 */
import { Env } from "../types/index.js";

/**
 * Generate a unique filename for a file
 * @param prefix - Prefix for the filename (default: 'file')
 * @returns A unique filename
 */
export function generateUniqueFilename(prefix: string = 'file', extension: string = 'bin'): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  
  return `${prefix}-${timestamp}-${randomString}.${extension}`;
}

/**
 * Convert base64 data to an ArrayBuffer
 * @param base64Data - Base64 encoded data
 * @returns ArrayBuffer of the decoded data
 */
export function base64ToArrayBuffer(base64Data: string): ArrayBuffer {
  // Ensure we strip any data URL prefix like "data:image/png;base64,"
  const base64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Uploads a file to Cloudflare R2 storage
 * 
 * @param fileData - File data as ArrayBuffer or plain text
 * @param env - Cloudflare Worker environment containing the R2 bucket
 * @param options - Upload options
 * @returns The CDN URL of the uploaded file
 */
export async function uploadToR2(
  fileData: ReadableStream | ArrayBuffer | string,
  env: Env,
  options: {
    filename?: string;
    prefix?: string;
    extension?: string;
  } = {}
): Promise<string> {
  if (!env.CDN_BUCKET) {
    throw new Error('R2 bucket not available');
  }
  
  // Generate or use provided filename
  const filename = options.filename || generateUniqueFilename(options.prefix, options.extension);
  
  // Upload to R2
  await env.CDN_BUCKET.put(filename, fileData);
  
  // Return CDN URL
  return `https://cdn.yovy.app/${filename}`;
}
