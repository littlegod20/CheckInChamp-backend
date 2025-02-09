import { scheduledJobs } from "node-schedule";
import { scheduleStandUpMessage } from "./schedule";
import { Team } from "../models/Team";
import { StandupResponse } from "../models/StandUpResponses";

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
          const updatedTeam = change.fullDocument;

          // Ensure timezone is preserved in case of missing field
          const existingTeam = await Team.findById(updatedTeam._id);
          const existingTimezone = existingTeam?.timezone || "GMT";

          await Team.updateOne(
            { _id: updatedTeam._id },
            {
              $set: {
                timezone: updatedTeam.timezone || existingTimezone,
              },
            }
          );

          scheduleStandUpMessage(updatedTeam.slackChannelId, updatedTeam);
          break;
        case "delete":
          const teamId = change.documentKey._id;
          const deletedTeam = await Team.findById(teamId);

          console.log("deletedTeam:", deletedTeam);

          if (deletedTeam) {
            console.log(
              `Deleting team with slackChannelId: ${deletedTeam.slackChannelId}`
            );

            // Cancel scheduled jobs
            if (
              deletedTeam.slackChannelId &&
              scheduledJobs[deletedTeam.slackChannelId]
            ) {
              Object.values(scheduledJobs[deletedTeam.slackChannelId])
                .flat()
                .forEach((job) => job.cancel());
              delete scheduledJobs[deletedTeam.slackChannelId];
              console.log(
                `Jobs for team with slackChannelId ${deletedTeam.slackChannelId} canceled.`
              );
            }

            // Delete related StandupResponses using slackChannelId
            const deletedResponses = await StandupResponse.deleteMany({
              slackChannelId: deletedTeam.slackChannelId,
            });
            console.log(
              `${deletedResponses.deletedCount} StandupResponses deleted for slackChannelId ${deletedTeam.slackChannelId}.`
            );
          } else {
            console.error(
              `No team found with _id: ${teamId}. Unable to delete responses.`
            );
          }

          break;
      }
    });
  } catch (error) {
    console.error("Error listening for team updates:", error);
  }
};
