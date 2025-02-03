import { DateTime } from "luxon";

/**
 * Converts a 12-hour format time string (e.g., "2:00 PM") to a 24-hour format string (e.g., "14:00").
 * @param time12hr - The time in 12-hour format (e.g., "2:00 PM").
 * @param timezone - The timezone to use for parsing (e.g., "UTC").
 * @returns The time in 24-hour format (e.g., "14:00").
 */
export const convert12hrTo24hr = (
  time12hr: string,
  timezone: string
): string => {
  // Parse the 12-hour format time using Luxon
  const time24hr = DateTime.fromFormat(time12hr, "h:mm a", { zone: timezone });

  if (!time24hr.isValid) {
    throw new Error(`Invalid time format: ${time12hr}`);
  }

  // Return the time in 24-hour format
  return time24hr.toFormat("HH:mm");
};
