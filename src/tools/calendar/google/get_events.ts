import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";

// Type definitions
export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start?: {
    dateTime: string;
    timeZone?: string;
  };
  end?: {
    dateTime: string;
    timeZone?: string;
  };
  status?: string;
  creator?: {
    email: string;
    displayName?: string;
  };
  organizer?: {
    email: string;
    displayName?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  location?: string;
  hangoutLink?: string;
  conferenceData?: any;
  recurringEventId?: string;
}

export interface GetEventsArgs {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
  showDeleted?: boolean;
}

// Tool definition
export const GET_CALENDAR_EVENTS_TOOL: Tool = {
  name: "google-calendar-get-events",
  description: "Retrieves calendar events from the user's Google Calendar within a specified time range.",
  inputSchema: {
    type: "object",
    properties: {
      timeMin: {
        type: "string",
        description: "Start time in RFC3339 format (e.g. 2024-12-01T00:00:00Z). Defaults to current time if not specified."
      },
      timeMax: {
        type: "string", 
        description: "End time in RFC3339 format (e.g. 2024-12-31T23:59:59Z). Optional."
      },
      maxResults: {
        type: "integer",
        description: "Maximum number of events to return (1-2500)",
        minimum: 1,
        maximum: 2500,
        default: 250
      },
      showDeleted: {
        type: "boolean",
        description: "Whether to include deleted events",
        default: false
      }
    }
  }
};

// Helper functions for type checking
export function isGetEventsArgs(args: unknown): args is GetEventsArgs {
  return (
    typeof args === "object" &&
    args !== null
  );
}

/**
 * Retrieves calendar events from the user's Google Calendar
 * 
 * @param apiKey - Google Calendar API key
 * @param args - Arguments for fetching events
 * @returns Formatted string with events list
 */
export async function getCalendarEvents(apiKey: string, args: GetEventsArgs): Promise<string> {
  try {
    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: apiKey });
    
    // Initialize Google Calendar API client with authenticated OAuth client
    const calendar = google.calendar({
      version: 'v3',
      auth: oauth2Client
    });
    
    // If no timeMin specified, use current time
    if (!args.timeMin) {
      args.timeMin = new Date().toISOString();
    }
    
    // Ensure maxResults is within limits
    const maxResults = Math.min(Math.max(1, args.maxResults || 250), 2500);
    
    // Prepare parameters
    const params: any = {
      calendarId: 'primary',
      timeMin: args.timeMin,
      maxResults: maxResults,
      singleEvents: true,
      orderBy: 'startTime',
      showDeleted: args.showDeleted || false
    };
    
    // Add optional timeMax if specified
    if (args.timeMax) {
      params.timeMax = args.timeMax;
    }
    
    // Make API call to get events
    const response = await calendar.events.list(params);
    
    const events = response.data.items || [];
    
    if (events.length === 0) {
      return "No events found in the specified time range.";
    }
    
    // Process and format events
    const processedEvents = events.map((event: any) => ({
      id: event.id,
      summary: event.summary,
      description: event.description,
      start: event.start,
      end: event.end,
      status: event.status,
      creator: event.creator,
      organizer: event.organizer,
      attendees: event.attendees,
      location: event.location,
      hangoutLink: event.hangoutLink,
      conferenceData: event.conferenceData,
      recurringEventId: event.recurringEventId
    }));
    
    return JSON.stringify(processedEvents, null, 2);
  } catch (error) {
    console.error("Error retrieving calendar events:", error);
    return `Error retrieving calendar events: ${error instanceof Error ? error.message : String(error)}`;
  }
}
