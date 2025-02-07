import { DateTime } from "luxon";
import schedule from "node-schedule";
import { sendStandupReminders } from "./sendStandupReminders";

export const scheduleReminder = async (
  teamId: string,
  standupId: string,
  reminderTimes: string[],
  timezone: string = "GMT"
) => {
  console.log("from scheduleReminder:", reminderTimes);

  // Convert 12-hour format time to 24-hour format
  reminderTimes.forEach((time12hr) => {
    const time24hr = DateTime.fromFormat(time12hr, "h:mm a", {
      zone: timezone,
    }).toFormat("HH:mm");

    // Parse the 24-hour format time using Luxon
    const reminderTime = DateTime.fromFormat(time24hr, "HH:mm", {
      zone: timezone,
    });

    if (!reminderTime.isValid) {
      console.error(`Invalid reminder time: ${time12hr}, Timezone: ${timezone}`);
      return;
    }

    const reminderRule = new schedule.RecurrenceRule();
    reminderRule.hour = reminderTime.hour;
    reminderRule.minute = reminderTime.minute;
    reminderRule.tz = timezone;

    console.log("reminder Rule:", reminderRule);

    schedule.scheduleJob(reminderRule, async () => {
      try {
        console.log(
          `Sending reminders for team ${teamId}, standupId: ${standupId}`
        );
        await sendStandupReminders(teamId, standupId);
      } catch (error) {
        console.error(
          `Error sending reminders for team ${teamId}, standup Id: ${standupId}`,
          error
        );
      }
    });

    console.log(`
      Scheduled reminder for team ${teamId} at ${reminderTime.toFormat(
      "HH:mm"
    )} ${timezone}
      `);
  });
};
