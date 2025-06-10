import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { readS3File } from "../../file/s3/read_file";
import { writeS3File } from "../../file/s3/write_to_file";
import { applyDiff } from "../../../utils/file_diff";

// Simple debug logger
function debugLog(message: string, ...args: any[]): void {
  console.log(`[S3_REPLACE_DEBUG] ${message}`, ...args);
}

// Type definitions
export interface S3ReplaceInFileArgs {
  path: string;
  diff: string;
}

// Tool definition
export const REPLACE_IN_FILE_TOOL: Tool = {
  name: "s3-edit-file",
  description: `Request to replace sections of content in an existing file using SEARCH/REPLACE blocks 
that define exact changes to specific parts of the file. 
This tool should be PRIORITIZED OVER write_to_file when making changes to existing files, especially large ones.

It's significantly more efficient for large files as it only modifies the targeted sections rather than
rewriting the entire file content, resulting in better performance and reduced resource usage.

The diff parameter should contain one or more SEARCH/REPLACE blocks following this format:
\`\`\`
<<<<<<< SEARCH
[exact content to find]
=======
[new content to replace with]
>>>>>>> REPLACE
\`\`\`

Critical rules:
1. SEARCH content must match EXACTLY (character-for-character, including whitespace and indentation)
2. SEARCH/REPLACE blocks only replace the first match occurrence
3. Use multiple SEARCH/REPLACE blocks for multiple changes, listed in order of appearance
4. Keep blocks concise - include just enough lines to uniquely match
5. To move code: use two blocks (one to delete, one to insert)
6. To delete code: use empty REPLACE section

Example:
\`\`\`
<<<<<<< SEARCH
function oldName() {
  return 'hello';
}
=======
function newName() {
  return 'hello world';
}
>>>>>>> REPLACE
\`\`\``,
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path of the file to modify"
      },
      diff: {
        type: "string",
        description: "One or more SEARCH/REPLACE blocks defining the changes to make"
      }
    },
    required: ["path", "diff"]
  }
};

// Helper function for argument validation
export function isS3ReplaceInFileArgs(args: unknown): args is S3ReplaceInFileArgs {
  return (
    typeof args === "object" &&
    args !== null &&
    "path" in args &&
    typeof (args as S3ReplaceInFileArgs).path === "string" &&
    "diff" in args &&
    typeof (args as S3ReplaceInFileArgs).diff === "string"
  );
}

/**
 * Replaces sections of content in a file in S3 storage
 * 
 * @param path - S3 file path
 * @param diff - Diff string with SEARCH/REPLACE blocks
 * @param apiKey - S3 API key
 * @returns Success message
 */
export async function replaceInS3File(path: string, diff: string, apiKey: string): Promise<string> {
  try {
    debugLog(`Starting replace operation on S3 file: ${path}`);
    
    // Read current content
    debugLog("Reading current content from S3");
    const currentContent = await readS3File(path, apiKey);
    
    // Apply diff directly using the imported applyDiff
    debugLog("Applying diff to content");
    // Process the entire diff at once (isFinal=true)
    const newContent = await applyDiff(diff, currentContent, true);
    
    // Determine if content was modified by comparing original and new content
    const modified = currentContent !== newContent;
    
    if (!modified) {
      debugLog("No changes needed, content matches search patterns");
      return `No changes applied to ${path} - content already matches the expected patterns`;
    }
    
    // Write modified content back
    debugLog("Writing modified content back to S3");
    const result = await writeS3File(path, newContent, apiKey);
    
    debugLog("Replace operation completed successfully");
    return `Successfully applied changes to ${path}`;
  } catch (error) {
    const errorMessage = `Failed to replace content in S3 file: ${error instanceof Error ? error.message : String(error)}`;
    debugLog(`ERROR: ${errorMessage}`);
    throw new Error(errorMessage);
  }
}
