import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";

// Tool definition
export const DELETE_DRAFT_TOOL: Tool = {
  name: "google-gmail-delete-draft",
  description: "Deletes a Gmail draft message by its ID. This action cannot be undone.",
  inputSchema: {
    type: "object",
    properties: {
      draftId: {
        type: "string",
        description: "The ID of the draft to delete"
      }
    },
    required: ["draftId"]
  }
};

// Helper functions for type checking
export function isDeleteDraftArgs(args: unknown): args is {
  draftId: string;
} {
  return (
    typeof args === "object" &&
    args !== null &&
    typeof (args as any).draftId === "string"
  );
}

/**
 * Delete a draft email by its ID
 * 
 * @param apiKey - Google Gmail API key
 * @param args - Parameters containing the draft ID
 * @returns Formatted string with the result
 */
export async function deleteDraft(apiKey: string, args: {
  draftId: string;
}): Promise<string> {
  try {
    const { draftId } = args;
    
    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: apiKey });
    
    // Initialize Gmail API client
    const gmail = google.gmail({
      version: 'v1',
      auth: oauth2Client
    });
    
    // Delete the draft
    await gmail.users.drafts.delete({
      userId: 'me',
      id: draftId
    });
    
    return "Successfully deleted draft";
  } catch (error) {
    console.error(`Error deleting draft ${args.draftId}:`, error);
    return `Failed to delete draft with ID: ${args.draftId}. Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}
