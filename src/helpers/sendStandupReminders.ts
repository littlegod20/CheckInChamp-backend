import { WebClient } from "@slack/web-api";
// import  getDocumentByField  from "./getDocumentByField";
import { Team } from "../models/Team";

// Initialize Slack client
const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

export const sendStandupReminders = async (
  teamId: string,
  standupId: string
) => {
  try {
    // Get team data
    const teamDoc = await Team.find({ teamId: teamId });
    const teamData = teamDoc[0];
    if (!teamData) {
      console.error("Team not found!");
      return;
    }

    console.log("Team Doc From Reminders:", teamDoc);

    const reminderTimes = teamData.standUpConfig.reminderTimes;

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
    // const standupDoc = await db.collection("standups").doc(standupId).get();
    // const responses: ResponsesTypes[] = standupDoc.exists
    //   ? standupDoc.data()?.responses
    //   : [];

    // if (!responses) {
    //   console.log("Nothing in responses. Sending reminder to all members...");
    //   // get all users, and send reminder
    //   for (const reminderTime of reminderTimes) {
    //     const reminderDateTime = new Date(`${today}T${reminderTime}:00Z`);
    //     console.log("now:", now, "\n", "reminderDateTime:", reminderDateTime);
    //     if (
    //       Math.floor(now.getTime() / 60000) ===
    //       Math.floor(reminderDateTime.getTime() / 60000)
    //     ) {
    //       console.log("setting reminder to members...");
    //       for (const member of members) {
    //         console.log("memberID:", member);
    //         await slackClient.chat.postMessage({
    //           channel: member,
    //           text: `Reminder: Please submit your standup reponses for today for <#${teamData.teamId}|${teamData.name}>`,
    //         });
    //       }
    //     } else {
    //       console.log("No matching done");
    //     }
    //   }
    //   return;
    // }

    // // fetch responded users
    // const respondedUsers = responses.map((item) => item.userId);

    // // check for missing users in the responses object
    // const nonRespondentUsers = members.filter(
    //   (item) => !respondedUsers.includes(item)
    // );

    // for (const reminderTime of reminderTimes) {
    //   const reminderDateTime = new Date(`${today}T${reminderTime}:00Z`);
    //   if (
    //     Math.floor(now.getTime() / 60000) ===
    //     Math.floor(reminderDateTime.getTime() / 60000)
    //   ) {
    //     for (const userId of nonRespondentUsers) {
    //       await slackClient.chat.postMessage({
    //         channel: userId,
    //         text: `Reminder: Please submit your standup reponses for today!`,
    //       });
    //     }
    //   }
    // }

    console.log("Reminders sent successfully!");
  } catch (error) {
    console.error("Error sending reminders:", error);
  }
};
