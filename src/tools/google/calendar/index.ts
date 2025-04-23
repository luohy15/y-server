// Export all calendar tools from a single file
export * from "./list_calendars";
export * from "./get_events";
export * from "./create_event";
export * from "./delete_event";

// Export a collection of all calendar tools
import { LIST_CALENDARS_TOOL } from "./list_calendars";
import { GET_CALENDAR_EVENTS_TOOL } from "./get_events";
import { CREATE_CALENDAR_EVENT_TOOL } from "./create_event";
import { DELETE_CALENDAR_EVENT_TOOL } from "./delete_event";

export const CALENDAR_TOOLS = [
  LIST_CALENDARS_TOOL,
  GET_CALENDAR_EVENTS_TOOL,
  CREATE_CALENDAR_EVENT_TOOL,
  DELETE_CALENDAR_EVENT_TOOL
];
