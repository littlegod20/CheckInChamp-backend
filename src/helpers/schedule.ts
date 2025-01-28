import schedule from "node-schedule";
import { WebClient } from "@slack/web-api";
import { DateTime } from "luxon";
import { config } from "dotenv";
import { scheduleReminder } from "./scheduleReminder";
import { StandupResponse } from "../models/StandUpResponses";

config();

// Initializing Slack web client
const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN as string);

// An object to store scheduled jobs by team and standup ID
const scheduledJobs: {
  [_id: string]: { [standupId: string]: schedule.Job[] };
} = {};

// Schedule a standup message for a team
export const scheduleStandUpMessage = (
  _id: string,
  teamData: TeamDocumentTypes
) => {
  const timezone = teamData.timeZone || "GMT";

  const { standUpDays, standUpTimes, reminderTimes } = teamData.standUpConfig;

  // console.log('Standup Config:', teamData.standUpConfig);

  if (
    !standUpDays ||
    !standUpTimes ||
    standUpDays.length === 0 ||
    standUpTimes.length === 0
  ) {
    console.log(
      `No valid standup configurations found for team: ${teamData.name}`
    );
    return;
  }

  // console.log("Scheduling StandUp for Team:", teamData.name);
  // console.log("StandUp Configuration:", teamData.teamstandupQuestions);

  // Cancel existing jobs for the team
  if (scheduledJobs[_id]) {
    Object.values(scheduledJobs[_id])
      .flat()
      .forEach((job) => job.cancel());
    delete scheduledJobs[_id];
    console.log(`Existing jobs for team ${_id} canceled.`);
  }

  // Prepare to schedule new jobs
  scheduledJobs[_id] = {};

  // Assign an ID to the standup (optional: use _id + timestamp or any unique identifier)
  const standupId = `${Date.now()}`;

  standUpDays.forEach((day: string) => {
    const dayOfWeek = DateTime.fromFormat(day, "cccc").weekday;

    standUpTimes.forEach((time: string) => {
      const standUpTime = DateTime.fromISO(time, { zone: timezone });

      if (!standUpTime.isValid) {
        console.error(`Invalid standup time: ${time}, Timezone: ${timezone}`);
        return;
      }

      const jobRule = new schedule.RecurrenceRule();
      jobRule.dayOfWeek = dayOfWeek;
      jobRule.hour = standUpTime.hour;
      jobRule.minute = standUpTime.minute;
      jobRule.tz = timezone;

      // console.log(`JobRule for ${teamData.name}:`, jobRule);

      // Schedule the standup job
      const job = schedule.scheduleJob(jobRule, async () => {
        try {
          console.log(
            `Sending standup message for Team: ${teamData.name}, Standup ID: ${standupId}`
          );

          const blocks = [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `📢 *Standup Reminder for Team "${teamData.name}"*:\nPlease click the button below to fill out your standup report.`,
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "Submit Standup",
                    emoji: true,
                  },
                  value: `standup_${standupId}`,
                  action_id: `submit_standup_${standupId}`,
                },
              ],
            },
          ];

          const message = await slackClient.chat.postMessage({
            channel: _id,
            blocks: blocks,
            text: `📢 *Standup Reminder for Team "${teamData.name}"*`,
          });

          // // Trigger reminders for non-respondents
          // if (reminderTimes && reminderTimes.length > 0) {
          //   scheduleReminder(_id, standupId, reminderTimes, timezone);
          // } else {
          //   console.error("reminder times not initialized");
          //   return;
          // }

          const standupMessageTs = message.ts;

          // // Store the `ts` in the database for later use
          await StandupResponse.updateOne(
            { messageTs: standupMessageTs, _id: _id }, // Query
            {
              $set: {
                messageTs: standupMessageTs,
                _id: _id,
                // teamName: teamData.name
              },
            },
            { upsert: true } // create if not found
          );
        } catch (error) {
          console.error(
            `Error in standup job for Team: ${teamData.name}, Standup ID: ${standupId}, channelID: ${_id}`,
            error
          );
        }
      });

      // Store the job
      scheduledJobs[_id][standupId] = scheduledJobs[_id][standupId] || [];
      scheduledJobs[_id][standupId].push(job);

      // console.log("Scheduled Jobs:", scheduledJobs);

      console.log(
        `Scheduled standup for ${
          teamData.name
        } on ${day} at ${standUpTime.toFormat(
          "HH:mm"
        )} ${timezone}, Standup ID: ${standupId}`
      );
    });
  });
};
