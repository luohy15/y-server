import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Env } from "../types/index.js";

// Type definitions
export interface ImageGenerationResponse {
  data: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
  created?: number;
}

/**
 * Generate a unique filename for an image
 * @param extension - File extension (default: png)
 * @returns A unique filename
 */
function generateUniqueFilename(extension: string = 'png'): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  return `y-image-${timestamp}-${randomString}.${extension}`;
}

/**
 * Convert base64 data to a buffer
 * @param base64Data - Base64 encoded data
 * @returns ArrayBuffer of the decoded data
 */
function base64ToArrayBuffer(base64Data: string): ArrayBuffer {
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
 * Save an image to the R2 bucket
 * @param imageData - Base64 encoded image data
 * @param contentType - The image content type
 * @param env - Cloudflare Worker environment
 * @returns Promise with the URL of the saved image
 */
async function saveImageToR2(imageData: string, env: Env, contentType: string = 'image/png'): Promise<string> {
  if (!env.CDN_BUCKET) {
    throw new Error('R2 bucket not available');
  }
  
  const filename = generateUniqueFilename();
  const imageBuffer = base64ToArrayBuffer(imageData);
  
  await env.CDN_BUCKET.put(filename, imageBuffer, {
    httpMetadata: {
      contentType: contentType
    }
  });
  
  return `https://cdn.yovy.app/${filename}`;
}

// Tool definition
export const IMAGE_GENERATE_TOOL: Tool = {
  name: "image_generate",
  description:
    "Generates images using AI models based on text prompts. " +
    "This tool leverages image generation capabilities to create visual content " +
    "from natural language descriptions. Ideal for creating illustrations, " +
    "concept art, or visualizing ideas described in text.",
  inputSchema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "Detailed text description of the image to generate"
      },
      model: {
        type: "string",
        description: "Model to use for image generation",
        default: "google/gemini-2.0-flash-exp:free"
      },
      size: {
        type: "string",
        enum: ["256x256", "512x512", "1024x1024"],
        description: "Size of the generated image",
        default: "1024x1024"
      },
      n: {
        type: "number",
        description: "Number of images to generate (1-4)",
        default: 1,
        minimum: 1,
        maximum: 4
      },
      response_format: {
        type: "string",
        enum: ["url", "b64_json"],
        description: "Format of the response (URL or base64 JSON)",
        default: "url"
      }
    },
    required: ["prompt"]
  }
};

// Helper functions
export function isImageGenerateArgs(args: unknown): args is { 
  prompt: string; 
  model?: string;
  size?: string;
  n?: number;
  response_format?: string;
} {
  return (
    typeof args === "object" &&
    args !== null &&
    "prompt" in args &&
    typeof (args as { prompt: string }).prompt === "string"
  );
}

/**
 * Generates images based on a text prompt using the image generation API
 * 
 * @param prompt - Text description of the image to generate
 * @param params - Additional generation parameters
 * @param apiKey - API key for authentication
 * @param env - Cloudflare Worker environment
 * @returns Formatted string with image generation results
 */
export async function performImageGeneration(
  prompt: string,
  params: {
    model?: string;
    size?: string;
    n?: number;
    response_format?: string;
  } = {},
  apiKey: string,
  env?: Env
): Promise<string> {
  const url = 'https://ir-api.myqa.cc/v1/openai/images/generations';
  
  const requestBody = {
    prompt,
    model: params.model || 'google/gemini-2.0-flash-exp:free',
    size: params.size || '1024x1024',
    n: Math.min(params.n || 1, 4),
    response_format: params.response_format || 'url'
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Image generation API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as ImageGenerationResponse;
    return await formatImageResults(data, prompt, env);
  } catch (error) {
    return `Error generating image: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Formats image generation results into a readable string
 * Also handles saving base64 images to R2 if available
 * 
 * @param response - The image generation API response
 * @param prompt - The original prompt used
 * @param env - Cloudflare Worker environment
 * @returns Formatted string with image generation results
 */
async function formatImageResults(response: ImageGenerationResponse, prompt: string, env?: Env): Promise<string> {
  const output: string[] = [];
  const imagePromises: Promise<void>[] = [];

  output.push(`Image Generation Results for prompt: "${prompt}"`);
  
  if (response.created) {
    const date = new Date(response.created * 1000);
    output.push(`Generated: ${date.toISOString()}`);
  }
  
  if (response.data && response.data.length > 0) {
    output.push(`\nGenerated ${response.data.length} image(s):\n`);
    
    // First pass to process base64 data and create promises
    for (let i = 0; i < response.data.length; i++) {
      const image = response.data[i];
      const imageIndex = i; // Capture for async use
      
      if (image.b64_json) {
        // Create a promise to save the image and update the output array asynchronously
        const savePromise = (async () => {
          try {
            // Save image to R2 bucket and get the CDN URL
            if (!env) {
              throw new Error('Environment not available for R2 storage');
            }
            const cdnUrl = await saveImageToR2(image.b64_json!, env);
            
            // Create the output entry
            let imageOutput = `[Image ${imageIndex + 1}]`;
            if (image.revised_prompt) {
              imageOutput += `\nRevised prompt: ${image.revised_prompt}`;
            }
            imageOutput += `\nURL: ${cdnUrl}`;
            
            // Replace the placeholder if it exists, otherwise add to the output
            const placeholderIndex = output.findIndex(line => 
              line.includes(`[Image ${imageIndex + 1}] Processing...`));
            
            if (placeholderIndex !== -1) {
              output[placeholderIndex] = imageOutput;
            } else {
              output.push(imageOutput);
            }
          } catch (error) {
            // If saving to R2 fails, fall back to showing base64 data (truncated)
            output.push(
              `[Image ${imageIndex + 1}]` +
              (image.revised_prompt ? `\nRevised prompt: ${image.revised_prompt}` : '') +
              `\nBase64 image data: ${image.b64_json!.substring(0, 30)}... (truncated)` +
              `\nError saving to CDN: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        })();
        
        imagePromises.push(savePromise);
        
        // Add a placeholder that will be replaced when the promise resolves
        output.push(`[Image ${imageIndex + 1}] Processing...`);
      } else if (image.url) {
        // Handle image URLs directly (no processing needed)
        output.push(
          `[Image ${imageIndex + 1}]` +
          (image.revised_prompt ? `\nRevised prompt: ${image.revised_prompt}` : '') +
          `\nURL: ${image.url}`
        );
      }
      
      // Add separator between results
      if (i < response.data.length - 1) {
        output.push('');
      }
    }
    
    // Wait for all async operations to complete
    await Promise.all(imagePromises);
  } else {
    output.push('No images were generated.');
  }

  // Remove any remaining processing placeholders
  const result = output
    .filter(line => !line.includes('Processing...'))
    .join('\n');
  
  return result;
}
