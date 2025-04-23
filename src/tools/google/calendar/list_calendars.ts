import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";

// Type definitions
export interface Calendar {
  id: string;
  summary: string;
  primary: boolean;
  timeZone?: string;
  etag?: string;
  accessRole?: string;
}

// Tool definition
export const LIST_CALENDARS_TOOL: Tool = {
  name: "google-calendar-list-calendars",
  description: "Lists all calendars accessible by the user. Call it before any other calendar tool whenever the user specifies a particular agenda (Family, Holidays, etc.).",
  inputSchema: {
    type: "object",
    properties: {}
  }
};

// Helper functions for type checking
export function isListCalendarsArgs(args: unknown): args is {} {
  return (
    typeof args === "object" &&
    args !== null
  );
}

/**
 * Lists all calendars accessible by the user
 * 
 * @param apiKey - Google Calendar API key
 * @returns Formatted string with calendar list
 */
export async function listCalendars(apiKey: string): Promise<string> {
  try {
    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: apiKey });
    
    // Initialize Google Calendar API client with authenticated OAuth client
    const calendar = google.calendar({
      version: 'v3',
      auth: oauth2Client
    });
    
    // Make API call to list calendars
    const response = await calendar.calendarList.list();
    
    if (!response.data.items || response.data.items.length === 0) {
      return "No calendars found for this user.";
    }
    
    // Format and return results
    const calendars = response.data.items.map((calendar: any) => ({
      id: calendar.id,
      summary: calendar.summary,
      primary: calendar.primary || false,
      timeZone: calendar.timeZone,
      etag: calendar.etag,
      accessRole: calendar.accessRole
    }));
    
    return JSON.stringify(calendars, null, 2);
  } catch (error) {
    console.error("Error listing calendars:", error);
    return `Error listing calendars: ${error instanceof Error ? error.message : String(error)}`;
  }
}
