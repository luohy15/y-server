/**
 * Utility functions for S3 operations
 * Used by the editor tools to interact with S3 compatible storage
 */
import { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";

/**
 * Parses S3 API key in the format https://aws_access_key_id:aws_secret_access_key@endpoint_url
 * 
 * @param apiKey - The S3 API key string
 * @returns Object with parsed credentials and endpoint
 */
export function parseS3ApiKey(apiKey: string): { 
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  bucket?: string;
  region: string;
} {
  // Debug: Log input API key (redacted for security)
  const redactedApiKey = apiKey.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  console.log(`[DEBUG] Parsing S3 API key: ${redactedApiKey}`);
  
  try {
    const url = new URL(apiKey);
    
    // Extract credentials from username and password
    const accessKeyId = url.username;
    const secretAccessKey = url.password;
    
    // Extract endpoint URL (protocol + hostname + port)
    const endpoint = `${url.protocol}//${url.hostname}${url.port ? ':' + url.port : ''}`;
    
    // Extract bucket name from pathname if present
    const pathParts = url.pathname.split('/').filter(Boolean);
    const bucket = pathParts.length > 0 ? pathParts[0] : undefined;
    
    // Set the region (extract from host if possible, or default to us-east-1)
    const region = url.hostname.includes('amazonaws.com') 
      ? url.hostname.split('.')[1] || 'us-east-1'
      : 'us-east-1';
    
    // Debug: Log extracted information (without exposing secret key)
    console.log(`[DEBUG] Parsed S3 credentials: 
      - Access Key ID: ${accessKeyId.substring(0, 4)}***
      - Endpoint: ${endpoint}
      - Region: ${region}
      - Default Bucket: ${bucket || 'none'}
    `);
    
    return { accessKeyId, secretAccessKey, endpoint, bucket, region };
  } catch (error) {
    // Debug: Log the error
    console.error(`[DEBUG] Error parsing S3 API key: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Invalid S3 API key format: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse a file path to extract bucket and key
 * 
 * @param path - File path to parse
 * @param defaultBucket - Default bucket name from the API key
 * @returns Object with bucket and key
 */
export function parseS3Path(path: string, defaultBucket?: string): { bucket: string; key: string } {
  // Strip leading slash if present
  const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
  
  // If path contains a bucket name (format: bucket/path/to/file)
  const parts = normalizedPath.split('/');
  
  if (defaultBucket) {
    // If default bucket is provided in the API key, use it
    return {
      bucket: defaultBucket,
      key: normalizedPath
    };
  } else if (parts.length >= 2) {
    // Extract bucket from path
    return {
      bucket: parts[0],
      key: parts.slice(1).join('/')
    };
  } else {
    throw new Error(`Invalid S3 path format: ${path}. Expected format: bucket/path/to/file`);
  }
}

/**
 * Creates an S3 client with the given credentials
 * 
 * @param credentials - S3 credentials parsed from API key
 * @returns Configured S3 client
 */
export function createS3Client({
  accessKeyId,
  secretAccessKey,
  endpoint,
  region
}: {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  region: string;
}): S3Client {
  // Determine if we're using a non-AWS S3 endpoint (like Cloudflare R2)
  const url = new URL(endpoint);
  const isNonAwsEndpoint = !url.hostname.includes('amazonaws.com');
  
  // Configure the S3 client
  const clientConfig: S3ClientConfig = {
    region,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  };
  
  // For non-AWS endpoints, we need to specify the custom endpoint
  // and use path-style addressing
  if (isNonAwsEndpoint) {
    clientConfig.endpoint = endpoint;
    clientConfig.forcePathStyle = true;
    
    console.log(`[DEBUG] Using custom S3 endpoint: ${endpoint} with path-style addressing`);
  } else {
    console.log(`[DEBUG] Using standard AWS S3 endpoint in region: ${region}`);
  }
  
  return new S3Client(clientConfig);
}
