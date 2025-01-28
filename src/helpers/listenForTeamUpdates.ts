import { scheduledJobs } from "node-schedule";
import { scheduleStandUpMessage } from "./schedule";
import { Team } from "../models/Team";

export const listenForTeamUpdates = async () => {
  try {
    // watch for changes in the team collection
    const changeStream = Team.watch([], { fullDocument: "updateLookup" });

    changeStream.on("change", async (change) => {
      switch (change.operationType) {
        case "insert":
          console.log(`Team ${change.fullDocument.name} added.`);
          scheduleStandUpMessage(
            change.fullDocument.slackChannelId,
            change.fullDocument
          );
          break;
        case "update":
          console.log(`Team ${change.fullDocument.name} updated.`);
          scheduleStandUpMessage(
            change.fullDocument.slackChannelId,
            change.fullDocument
          );
          break;
        case "delete":
          console.log(`Team ${change.fullDocument.name} deleted.`);
          if (scheduledJobs[change.fullDocument.slackChannelId]) {
            Object.values(scheduledJobs[change.fullDocument.slackChannelId])
              .flat()
              .forEach((job) => job.cancel());
            delete scheduledJobs[change.fullDocument.slackChannelId];
            console.log(
              `Jobs for team ${change.fullDocument.slackChannelId} canceled.`
            );
          }
          break;
      }
    });
  } catch (error) {
    console.error("Error listening for team updates:", error);
  }
};
