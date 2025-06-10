/**
 * Common utility functions for file operations
 * Used by various file tools
 */

/**
 * Downloads content from a URL, supporting both text and binary files
 * 
 * @param url - The URL to download content from
 * @returns The downloaded content as an ArrayBuffer
 */
export async function downloadFromUrl(url: string): Promise<ArrayBuffer> {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    // Get the response as an ArrayBuffer for universal support
    return await response.arrayBuffer();
  } catch (error) {
    throw new Error(`Failed to download from URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}
