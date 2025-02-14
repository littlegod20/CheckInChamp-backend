import schedule from "node-schedule";
import { WebClient } from "@slack/web-api";
import { DateTime } from "luxon";
import { config } from "dotenv";
import { scheduleReminder } from "./scheduleReminder";
import { StandupResponse } from "../models/StandUpResponses";
import { convert12hrTo24hr } from "./convert12hrTo24hr";
import { TeamDocumentTypes } from "../types/TeamDocuments";

config();

// Initializing Slack web client
const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN as string);

// An object to store scheduled jobs by team and standup ID
const scheduledJobs: {
  [slackChannelId: string]: { [standupId: string]: schedule.Job[] };
} = {};

// Schedule a standup message for a team
export const scheduleStandUpMessage = (
  slackChannelId: string,
  teamData: TeamDocumentTypes
) => {
  console.log(
    "Server timezone:",
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  const timezone = teamData.timezone || "GMT";

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

  // Cancel existing jobs for the team
  if (scheduledJobs[slackChannelId]) {
    Object.values(scheduledJobs[slackChannelId])
      .flat()
      .forEach((job) => job.cancel());
    delete scheduledJobs[slackChannelId];
    console.log(`Existing jobs for team ${slackChannelId} canceled.`);
  }

  // Prepare to schedule new jobs
  scheduledJobs[slackChannelId] = {};

  // Assign an ID to the standup (optional: use slackChannelId + timestamp or any unique identifier)
  const standupId = `${Date.now()}`;

  standUpDays.forEach((day: string) => {
    const dayOfWeek = DateTime.fromFormat(day, "cccc").weekday % 7;

    standUpTimes.forEach((time12hr: string) => {
      try {
        // Convert 12-hour format time to 24-hour format
        const time24hr = convert12hrTo24hr(time12hr, timezone);

        // Parse the 24-hour format time using Luxon
        const standUpTime = DateTime.fromFormat(time24hr, "HH:mm", {
          zone: timezone,
        });

        // console.log("log hour:", standUpTime.hour);
        // console.log("log minute:", standUpTime.minute);

        if (!standUpTime.isValid) {
          console.error(
            `Invalid standup time: ${time24hr}, Timezone: ${timezone}`
          );
          return;
        }

        console.log("log Time for standup:", standUpTime);
        // Create job rule
        const jobRule = new schedule.RecurrenceRule();
        jobRule.dayOfWeek = dayOfWeek;
        jobRule.hour = standUpTime.hour;
        jobRule.minute = standUpTime.minute;
        jobRule.tz = timezone;

        console.log("Job Rule:", {
          dayOfWeek: jobRule.dayOfWeek,
          hour: jobRule.hour,
          minute: jobRule.minute,
          tz: jobRule.tz,
        });

        // const testTime = new Date(Date.now() + 60 * 1000); // 1 minute from now
        // const testJob = schedule.scheduleJob(testTime, () => {
        //   console.log("Test job running at:", new Date().toISOString());
        // });
        // console.log("Test job scheduled for:", testTime.toISOString());

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
              channel: slackChannelId,
              blocks: blocks,
              text: `📢 *Standup Reminder for Team "${teamData.name}"*`,
            });

            console.log("Standup message sent:", message.ts);

            // Trigger reminders for non-respondents
            if (reminderTimes && reminderTimes.length > 0) {
              scheduleReminder(
                slackChannelId,
                standupId,
                reminderTimes,
                timezone
              );
            } else {
              console.error("reminder times not initialized");
              return;
            }
            // Create a new StandupResponse document if it doesn't exist
            await StandupResponse.updateOne(
              { standupId: standupId }, // Query
              {
                $setOnInsert: {
                  messageTs: message.ts, // Store the timestamp of the standup message
                  slackChannelId: slackChannelId,
                  teamName: teamData.name,
                  standupId: standupId,
                  date: new Date().toISOString(), // Store the date of the standup
                  responses: [], // Initialize responses array
                },
              },
              { upsert: true } // Create if not found
            );
          } catch (error) {
            console.error(
              `Error in standup job for Team: ${teamData.name}, Standup ID: ${standupId}, channelID: ${slackChannelId}`,
              error
            );
          }
        });
        // Store the job
        scheduledJobs[slackChannelId][standupId] =
          scheduledJobs[slackChannelId][standupId] || [];
        scheduledJobs[slackChannelId][standupId].push(job);
        console.log(
          `Scheduled standup for ${
            teamData.name
          } on ${day} at ${standUpTime.toFormat(
            "HH:mm"
          )} ${timezone}, Standup ID: ${standupId}`
        );
      } catch (err) {
        console.error(err);
      }
    });
  });
};
