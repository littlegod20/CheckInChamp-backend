import { DateTime } from "luxon";
import schedule from "node-schedule";
import { sendStandupReminders } from "./sendStandupReminders";

export const scheduleReminder = async (
  teamId: string,
  standupId: string,
  reminderTimes: string[],
  timezone: string = "GMT"
) => {
  reminderTimes.forEach((time) => {
    const reminderTime = DateTime.fromISO(time, { zone: timezone });

    if (!reminderTime.isValid) {
      console.error(`Invalid reminder time: ${time}, Timezone: ${timezone}`);
      return;
    }

    const reminderRule = new schedule.RecurrenceRule();
    reminderRule.hour = reminderTime.hour;
    reminderRule.minute = reminderTime.minute;
    reminderRule.tz = timezone;

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
