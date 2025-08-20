import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Env } from "../../../types/index.js";
import { bv2av } from "../../../utils/bilibili_utils.js";

// Type definitions
export interface BilibiliFetchParams {
  bvid: string;
  p?: number; // Page number for multi-part videos (defaults to 1)
}

interface BilibiliVideoResponse {
  code: number;
  message: string;
  ttl: number;
  data: {
    bvid: string;
    aid: number;
    videos: number;
    title: string;
    desc: string;
    cid: number;
    duration: number;
    owner: {
      mid: number;
      name: string;
      face: string;
    };
    pages: Array<{
      cid: number;
      page: number;
      part: string;
      duration: number;
    }>;
    subtitle: {
      allow_submit: boolean;
      list: Array<{
        id: number;
        lan: string;
        lan_doc: string;
        is_lock: boolean;
        subtitle_url: string;
        type: number;
        id_str: string;
        ai_type: number;
        ai_status: number;
      }>;
    };
  };
}

interface BilibiliSubtitleResponse {
  code: number;
  message: string;
  ttl: number;
  data: {
    subtitle: {
      allow_submit: boolean;
      lan: string;
      lan_doc: string;
      subtitles: Array<{
        id: number;
        lan: string;
        lan_doc: string;
        is_lock: boolean;
        subtitle_url: string;
        subtitle_url_v2: string;
        type: number;
        id_str: string;
        ai_type: number;
        ai_status: number;
      }>;
    };
  };
}

interface BilibiliSubtitleContent {
  font_size: number;
  font_color: string;
  background_alpha: number;
  background_color: string;
  Stroke: string;
  type: string;
  lang: string;
  version: string;
  body: Array<{
    from: number;
    to: number;
    sid: number;
    location: number;
    content: string;
    music: number;
  }>;
}

// Tool definition
export const BILIBILI_FETCH_TOOL: Tool = {
  name: "bilibili-subtitle-fetch",
  description: "Fetch subtitles from a Bilibili video using BV number.",
  inputSchema: {
    type: "object",
    properties: {
      bvid: {
        type: "string",
        description: "The Bilibili BV ID (e.g., BV1xx411c7mD)",
      },
      p: {
        type: "number",
        description: "Page number for multi-part videos (e.g., 2 for ?p=2, defaults to 1 if not specified)",
      }
    },
    required: ["bvid"],
  },
};

// Helper function to check arguments
export function isBilibiliFetchArgs(args: unknown): args is BilibiliFetchParams {
  return (
    typeof args === "object" &&
    args !== null &&
    "bvid" in args &&
    typeof (args as { bvid: unknown }).bvid === "string"
  );
}



/**
 * Fetches subtitles from a Bilibili video using standard fetch with API key as cookie
 * 
 * @param params - The fetch parameters (BV ID)
 * @param apiKey - API key used as cookie content for authentication
 * @param env - Environment (not used anymore but kept for consistency)
 * @returns Subtitle content from the video
 */
export async function performBilibiliFetch(
  params: BilibiliFetchParams,
  apiKey: string,
  env?: Env
): Promise<string> {
  if (!apiKey) {
    return "Error: API key not available";
  }

  try {
    // Convert BV to AV
    const aid = bv2av(params.bvid);
    console.log(`BV ${params.bvid} converted to AV ${aid}`);
    
    // Step 1: Get video info and CID
    const videoInfoUrl = `https://api.bilibili.com/x/web-interface/view?aid=${aid}`;
    const videoInfoResponse = await fetch(videoInfoUrl, {
      headers: {
        'Cookie': apiKey,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
      }
    });
    const videoInfo = await videoInfoResponse.json() as BilibiliVideoResponse;
    
    if (videoInfo.code !== 0) {
      throw new Error(`Bilibili API error: ${videoInfo.message}`);
    }

    // Get CID for the specified page (default to page 1)
    const pageNum = params.p || 1;
    const targetPage = videoInfo.data.pages.find(page => page.page === pageNum);
    
    if (!targetPage) {
      throw new Error(`Page ${pageNum} not found. Available pages: ${videoInfo.data.pages.map(p => p.page).join(', ')}`);
    }
    
    const cid = targetPage.cid;
    const title = videoInfo.data.title;
    const partTitle = targetPage.part;

    // Step 2: Get subtitle info
    const subtitleInfoUrl = `https://api.bilibili.com/x/player/wbi/v2?aid=${aid}&cid=${cid}`;
    const subtitleInfoResponse = await fetch(subtitleInfoUrl, {
      headers: {
        'Cookie': apiKey,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
      }
    });
    const subtitleInfo = await subtitleInfoResponse.json() as BilibiliSubtitleResponse;
    console.log(`Subtitle info for AV ${aid}:`, subtitleInfo);
    
    if (subtitleInfo.code !== 0) {
      throw new Error(`Subtitle API error: ${subtitleInfo.message}`);
    }

    const subtitles = subtitleInfo.data?.subtitle?.subtitles;
    
    if (!subtitles || subtitles.length === 0) {
      return formatBilibiliResponse(null, params.bvid, title, "No subtitles available for this video", partTitle, pageNum);
    }

    // Get the first available subtitle (usually Chinese)
    const subtitleUrl = `https:${subtitles[0].subtitle_url}`;
    const subtitleLang = subtitles[0].lan_doc;

    console.log(`Fetching subtitles from: ${subtitleUrl} (${subtitleLang})`);

    // Step 3: Fetch actual subtitle content
    const subtitleResponse = await fetch(subtitleUrl, {
      headers: {
        'Cookie': apiKey,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
      }
    });
    const subtitleData = await subtitleResponse.json() as BilibiliSubtitleContent;
    
    return formatBilibiliResponse(subtitleData, params.bvid, title, `Subtitles (${subtitleLang})`, partTitle, pageNum);

  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

/**
 * Formats the Bilibili subtitle response
 * 
 * @param subtitleData - The subtitle data from Bilibili API
 * @param bvid - The original BV ID
 * @param title - Video title
 * @param status - Status message
 * @returns Formatted string with video info and subtitles
 */
function formatBilibiliResponse(
  subtitleData: BilibiliSubtitleContent | null,
  bvid: string,
  title: string,
  status: string,
  partTitle?: string,
  pageNum?: number
): string {
  const output: string[] = [];

  // Add video info
  output.push(`Bilibili Video: ${bvid}`);
  output.push(`Title: ${title}`);
  if (pageNum && pageNum > 1) {
    output.push(`Page: ${pageNum}`);
    if (partTitle) {
      output.push(`Part Title: ${partTitle}`);
    }
  }
  output.push(`Status: ${status}\n`);

  // Add subtitle content if available
  if (subtitleData && subtitleData.body) {
    output.push("Subtitles:");
    output.push("=" + "=".repeat(50));
    
    for (const item of subtitleData.body) {
      const startTime = formatTime(item.from);
      const endTime = formatTime(item.to);
      output.push(`[${startTime} --> ${endTime}] ${item.content}`);
    }
  }

  return output.join("\n");
}

/**
 * Convert seconds to timestamp format
 */
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}