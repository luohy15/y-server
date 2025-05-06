/**
 * Utility functions for S3 operations
 * Used by the editor tools to interact with S3 compatible storage
 */

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
    
    // Debug: Log extracted information (without exposing secret key)
    console.log(`[DEBUG] Parsed S3 credentials: 
      - Access Key ID: ${accessKeyId.substring(0, 4)}***
      - Endpoint: ${endpoint}
      - Default Bucket: ${bucket || 'none'}
    `);
    
    return { accessKeyId, secretAccessKey, endpoint, bucket };
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
 * Generate AWS Signature v4 for S3 API requests
 * 
 * @param method - HTTP method (GET, PUT, etc.)
 * @param region - AWS region
 * @param bucket - S3 bucket name
 * @param key - S3 object key
 * @param accessKeyId - AWS access key ID
 * @param secretAccessKey - AWS secret access key
 * @param payload - Request payload (for PUT requests)
 * @param contentType - Content-Type header (for PUT requests)
 * @returns Object with headers needed for the request
 */
export async function generateS3Headers(
  method: string,
  endpoint: string,
  bucket: string,
  key: string,
  accessKeyId: string,
  secretAccessKey: string,
  payload: string = '',
  contentType: string = ''
): Promise<Record<string, string>> {
  // Parse the endpoint to get the host
  const url = new URL(endpoint);
  const host = url.host;
  
  // Determine if we're using a non-AWS S3 endpoint (like Cloudflare R2)
  const isNonAwsEndpoint = !host.includes('amazonaws.com');
  
  // Use path-style addressing for non-AWS endpoints like Cloudflare R2
  const usePathStyle = isNonAwsEndpoint;
  
  // Log the addressing style being used
  console.log(`[DEBUG] Using ${usePathStyle ? 'path-style' : 'virtual-hosted style'} addressing for ${host}`);
  
  // Set the region (extract from host if possible, or default to us-east-1)
  const region = host.includes('amazonaws.com') 
    ? host.split('.')[1] || 'us-east-1'
    : 'us-east-1';
  
  // Get current timestamp
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amzDate.substring(0, 8);
  
  // Calculate payload hash
  const payloadHash = await sha256(payload);
  
  // Prepare canonical request
  // For path-style URLs, the key is prefixed with the bucket name
  const canonicalUri = usePathStyle ? `/${bucket}/${key}` : `/${key}`;
  const canonicalQueryString = '';
  
  // For path-style URLs, don't prepend the bucket to the host
  const hostHeader = usePathStyle ? host : `${bucket}.${host}`;
  
  const canonicalHeaders = [
    `host:${hostHeader}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`
  ].join('\n') + '\n';
  
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');
  
  // Calculate signature
  const algorithm = 'AWS4-HMAC-SHA256';
  const scope = `${date}/${region}/s3/aws4_request`;
  
  const stringToSign = [
    algorithm,
    amzDate,
    scope,
    await sha256(canonicalRequest)
  ].join('\n');
  
  const signingKey = await getSignatureKey(secretAccessKey, date, region, 's3');
  const signature = await hmacSha256(signingKey, stringToSign, 'hex');
  
  // Build authorization header
  const authorizationHeader = [
    `${algorithm} Credential=${accessKeyId}/${scope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(', ');
  
  // Construct headers
  const headers: Record<string, string> = {
    'Authorization': authorizationHeader,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate
  };
  
  // Add Content-Type if provided
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  
  return headers;
}

/**
 * Calculate SHA-256 hash
 * 
 * @param message - Message to hash
 * @returns Hex-encoded hash
 */
export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Calculate HMAC-SHA256
 * 
 * @param key - Key as ArrayBuffer or Uint8Array
 * @param message - Message to sign
 * @param outputFormat - Output format (hex or binary)
 * @returns Signed message in the specified format
 */
export async function hmacSha256(
  key: ArrayBuffer | Uint8Array,
  message: string,
  outputFormat: 'hex' | 'binary' = 'binary'
): Promise<string | ArrayBuffer> {
  const keyObj = await crypto.subtle.importKey(
    'raw',
    key instanceof ArrayBuffer ? key : key.buffer,
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    keyObj,
    new TextEncoder().encode(message)
  );
  
  if (outputFormat === 'hex') {
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  return signature;
}

/**
 * Get AWS Signature v4 signing key
 * 
 * @param key - AWS secret key
 * @param dateStamp - Date stamp in format YYYYMMDD
 * @param regionName - AWS region name
 * @param serviceName - AWS service name
 * @returns Signing key as ArrayBuffer
 */
export async function getSignatureKey(
  key: string,
  dateStamp: string,
  regionName: string,
  serviceName: string
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(
    new TextEncoder().encode(`AWS4${key}`),
    dateStamp,
    'binary'
  ) as ArrayBuffer;
  
  const kRegion = await hmacSha256(
    kDate,
    regionName,
    'binary'
  ) as ArrayBuffer;
  
  const kService = await hmacSha256(
    kRegion,
    serviceName,
    'binary'
  ) as ArrayBuffer;
  
  const kSigning = await hmacSha256(
    kService,
    'aws4_request',
    'binary'
  ) as ArrayBuffer;
  
  return kSigning;
}
