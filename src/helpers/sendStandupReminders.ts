import { WebClient } from "@slack/web-api";
// import  getDocumentByField  from "./getDocumentByField";
import { Team } from "../models/Team";
import { StandupResponse } from "../models/StandUpResponses";
import { convert12hrTo24hr } from "./convert12hrTo24hr";
import { DateTime } from "luxon";

// Initialize Slack client
const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

// export const convert12hrTo24hr = (time12h: string): string => {
//   return DateTime.fromFormat(time12h, "hh:mm a").toFormat("HH:mm");
// };

export const sendStandupReminders = async (
  slackChannelId: string,
  standupId: string
) => {
  try {
    // Get team data
    const teamDoc = (await Team.find({
      slackChannelId: slackChannelId,
    })) as unknown as TeamDocumentTypes[];

    if (!teamDoc) {
      console.error("Team not found!");
      return;
    }

    const teamData = teamDoc[0];

    console.log("Team Doc From Reminders:", teamData);

    const reminderTimes = teamData.standUpConfig.reminderTimes.map((time) =>
      convert12hrTo24hr(time, teamData.timezone)
    );
    console.log("reminderTimes:", reminderTimes);

    if (!reminderTimes || reminderTimes.length === 0) {
      console.log("No reminder times configured.");
      return;
    }

    // get all user from team
    const members = teamData.members;
    const now = new Date();

    // Get current date in YYYY-MM-DD format
    const today = now.toISOString().split("T")[0];

    // Check standup responses
    const standupDoc = (await StandupResponse.find({
      standupId: standupId,
    })) as unknown as StandupResponseTypes;
    const responses: ResponsesTypes[] = standupDoc ? standupDoc?.responses : [];

    if (!responses) {
      console.log("Nothing in responses. Sending reminder to all members...");
      // get all users, and send reminder
      for (const reminderTime of reminderTimes) {
        console.log("reminderTime:", reminderTime);
        const reminderDateTime = new Date(`${today}T${reminderTime}:00Z`);
        console.log("now:", now, "\n", "reminderDateTime:", reminderDateTime);
        if (
          Math.floor(now.getTime() / 60000) ===
          Math.floor(reminderDateTime.getTime() / 60000)
        ) {
          console.log("setting reminder to members...");
          for (const member of members) {
            console.log("memberID:", member);
            await slackClient.chat.postMessage({
              channel: member,
              text: `Reminder: Please submit your standup reponses for today for <#${teamData.slackChannelId}|${teamData.name}>`,
            });
          }
        } else {
          console.log("No matching done");
        }
      }
      return;
    }

    // fetch responded users
    const respondedUsers = standupDoc.userId;

    // check for missing users in the responses object
    const nonRespondentUsers = members.filter(
      (item) => !respondedUsers.includes(item)
    );

    for (const reminderTime of reminderTimes) {
      const reminderDateTime = new Date(`${today}T${reminderTime}:00Z`);
      if (
        Math.floor(now.getTime() / 60000) ===
        Math.floor(reminderDateTime.getTime() / 60000)
      ) {
        for (const userId of nonRespondentUsers) {
          await slackClient.chat.postMessage({
            channel: userId,
            text: `Reminder: Please submit your standup reponses for today!`,
          });
        }
      }
    }

    console.log("Reminders sent successfully!");
  } catch (error) {
    console.error("Error sending reminders:", error);
  }
};
