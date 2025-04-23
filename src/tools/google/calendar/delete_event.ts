import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";

// Type definitions
export interface DeleteEventArgs {
  eventId: string;
  sendNotifications?: boolean;
  calendarId?: string;
}

// Tool definition
export const DELETE_CALENDAR_EVENT_TOOL: Tool = {
  name: "google-calendar-delete-event",
  description: "Deletes an event from the user's Google Calendar by its event ID.",
  inputSchema: {
    type: "object",
    properties: {
      eventId: {
        type: "string",
        description: "The ID of the calendar event to delete"
      },
      sendNotifications: {
        type: "boolean",
        description: "Whether to send cancellation notifications to attendees",
        default: true
      },
      calendarId: {
        type: "string",
        description: "Optional ID of the specific calendar. If not provided, the primary calendar is used.",
        default: "primary"
      }
    },
    required: ["eventId"]
  }
};

// Helper functions for type checking
export function isDeleteEventArgs(args: unknown): args is DeleteEventArgs {
  return (
    typeof args === "object" &&
    args !== null &&
    typeof (args as DeleteEventArgs).eventId === "string"
  );
}

/**
 * Deletes an event from the user's Google Calendar by its event ID
 * 
 * @param apiKey - Google Calendar API key
 * @param args - Arguments for deleting the event
 * @returns Formatted string with the deletion result
 */
export async function deleteCalendarEvent(apiKey: string, args: DeleteEventArgs): Promise<string> {
  try {
    // Validate required arguments
    if (!args.eventId) {
      return "Error: Missing required argument (eventId)";
    }
    
    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: apiKey });
    
    // Initialize Google Calendar API client with authenticated OAuth client
    const calendar = google.calendar({
      version: 'v3',
      auth: oauth2Client
    });
    
    // Delete the event
    await calendar.events.delete({
      calendarId: args.calendarId || 'primary',
      eventId: args.eventId,
      sendNotifications: args.sendNotifications !== false
    });
    
    return JSON.stringify({
      success: true,
      message: "Event successfully deleted"
    }, null, 2);
  } catch (error) {
    console.error("Error deleting calendar event:", error);
    return JSON.stringify({
      success: false,
      message: `Error deleting event: ${error instanceof Error ? error.message : String(error)}`
    }, null, 2);
  }
}
