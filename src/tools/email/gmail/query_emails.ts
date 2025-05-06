import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";

// Type definitions
export interface EmailMetadata {
  id: string;
  threadId: string;
  historyId?: string;
  internalDate?: string;
  sizeEstimate?: number;
  labelIds?: string[];
  snippet?: string;
  subject?: string;
  from?: string;
  to?: string;
  date?: string;
  cc?: string;
  bcc?: string;
  message_id?: string;
  in_reply_to?: string;
  references?: string;
  delivered_to?: string;
}

// Tool definition
export const QUERY_EMAILS_TOOL: Tool = {
  name: "google-gmail-query-emails",
  description: "Query Gmail emails based on an optional search query. Returns emails in reverse chronological order (newest first).",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Gmail search query (optional). Examples: 'is:unread', 'from:example@gmail.com', 'newer_than:2d', 'has:attachment'"
      },
      maxResults: {
        type: "integer",
        description: "Maximum number of emails to retrieve (1-500)",
        minimum: 1,
        maximum: 500,
        default: 100
      }
    }
  }
};

// Helper functions for type checking
export function isQueryEmailsArgs(args: unknown): args is {
  query?: string;
  maxResults?: number;
} {
  return (
    typeof args === "object" &&
    args !== null &&
    ((args as any).query === undefined || typeof (args as any).query === "string") &&
    ((args as any).maxResults === undefined || typeof (args as any).maxResults === "number")
  );
}

/**
 * Query Gmail emails based on search criteria
 * 
 * @param apiKey - Google Gmail API key
 * @param args - Query parameters
 * @returns Formatted string with email results
 */
export async function queryEmails(apiKey: string, args: {
  query?: string;
  maxResults?: number;
}): Promise<string> {
  try {
    const { query = "", maxResults = 100 } = args;
    
    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: apiKey });
    
    // Initialize Gmail API client
    const gmail = google.gmail({
      version: 'v1',
      auth: oauth2Client
    });
    
    // Make API call to list messages
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: Math.min(Math.max(1, maxResults), 500)
    });
    
    if (!response.data.messages || response.data.messages.length === 0) {
      return "No emails found matching the query.";
    }
    
    // Fetch full details for each message
    const emails: EmailMetadata[] = [];
    
    for (const msg of response.data.messages) {
      const messageDetail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!
      });
      
      const email = parseMessage(messageDetail.data);
      emails.push(email);
    }
    
    return JSON.stringify(emails, null, 2);
  } catch (error) {
    console.error("Error querying emails:", error);
    return `Error querying emails: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Helper function to decode base64 data
 */
function decodeBase64(data: string): string {
  // Convert URL-safe base64 to standard base64
  const standardBase64 = data.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const paddedBase64 = standardBase64.padEnd(
    standardBase64.length + (4 - (standardBase64.length % 4 || 4)) % 4, 
    '='
  );
  // Decode
  try {
    return decodeURIComponent(
      Array.prototype.map.call(
        atob(paddedBase64),
        (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join('')
    );
  } catch (e) {
    // Fallback for non-UTF-8 content
    return atob(paddedBase64);
  }
}

/**
 * Parse a Gmail message into a structured format
 */
function parseMessage(message: any): EmailMetadata {
  const headers = message.payload?.headers || [];
  
  const email: EmailMetadata = {
    id: message.id,
    threadId: message.threadId,
    historyId: message.historyId,
    internalDate: message.internalDate,
    sizeEstimate: message.sizeEstimate,
    labelIds: message.labelIds || [],
    snippet: message.snippet
  };
  
  // Extract headers
  for (const header of headers) {
    const name = header.name.toLowerCase();
    const value = header.value;
    
    if (name === 'subject') {
      email.subject = value;
    } else if (name === 'from') {
      email.from = value;
    } else if (name === 'to') {
      email.to = value;
    } else if (name === 'date') {
      email.date = value;
    } else if (name === 'cc') {
      email.cc = value;
    } else if (name === 'bcc') {
      email.bcc = value;
    } else if (name === 'message-id') {
      email.message_id = value;
    } else if (name === 'in-reply-to') {
      email.in_reply_to = value;
    } else if (name === 'references') {
      email.references = value;
    } else if (name === 'delivered-to') {
      email.delivered_to = value;
    }
  }
  
  return email;
}
