import { scheduleStandUpMessage } from "../helpers/schedule";
import { Team } from "../models/Team";

export const initializeSchedules = async () => {
  try {
    const teamSnapshot = (await Team.find()) as TeamDocumentTypes[];

    if (teamSnapshot.length === 0) {
      console.log("No teams found.");
      return;
    }

    teamSnapshot.forEach((team) => {
      // console.log("Normalized TeamData:", team);

      scheduleStandUpMessage(team.slackChannelId, team);
    });
    console.log("All standup schedules initialized.");
  } catch (error) {
    console.error("Error initializing schedules:", error);
  }
};
