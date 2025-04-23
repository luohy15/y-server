/**
 * Encode a string to base64url format, supporting Unicode (e.g., Chinese)
 */
export function encodeBase64Url(text: string): string {
  // Convert string to UTF-8 encoded bytes
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);

  // Convert bytes to base64
  const base64 = btoa(String.fromCharCode(...bytes));

  // Convert to base64url (URL-safe base64)
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
