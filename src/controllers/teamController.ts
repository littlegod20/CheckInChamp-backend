import { Request, Response } from "express";
import { Team, TeamDocument } from "../models/Team";
import { writeToStream } from "@fast-csv/format";
import { format } from "date-fns";
import { web as slackClient } from "../config/slack";
import { StandupResponse } from "../models/StandUpResponses";

//function required to create a team
export const createTeam = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { name, members, standUpConfig, timezone } = req.body;
  // console.log("Received POST /teams request with body:", req.body);
  // console.log("StandupConfig:", standUpConfig);

  try {
    // Check if the required fields are present
    if (
      !name ||
      !members ||
      members.length === 0 ||
      !standUpConfig ||
      standUpConfig.length === 0 ||
      !timezone
    ) {
      res.status(400).json({
        error: "Please provide name, members, standUpConfig, and timezone",
        data: req.body,
      });
      return;
    }

    // Check if the team already exists
    const existingTeam = await Team.findOne({ name });
    if (existingTeam) {
      res.status(400).json({ error: `Team with name ${name} already exists` });
      return;
    }

    const channelName = `team-${name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")}`;

    // Create a new team with the provided data
    const team = await Team.create({
      name: channelName,
      members,
      standUpConfig,
      timezone,
    });

    const slackChannelResponse = await slackClient.conversations.create({
      name: channelName,
      is_private: false, // Set to `false` if you want it to be a public channel
    });

    //get the slack channel details after successfully creating it
    if (slackChannelResponse.ok && slackChannelResponse.channel) {
      await slackClient.conversations.invite({
        channel: slackChannelResponse.channel.id as string,
        users: members.join(","), // Invite all members to the channel
      });
      team.slackChannelId = slackChannelResponse.channel.id as string;
      await team.save();
    } else {
      // If the Slack channel creation fails, delete the team
      await Team.findByIdAndDelete(team._id);
      throw new Error(
        `Failed to create Slack channel for team: ${slackChannelResponse.error}`
      );
    }

    //respond if successful
    res.status(201).json({
      message: "Team created successfully",
      team,
      slackChannel: slackChannelResponse.channel,
    });
  } catch (error: any) {
    // Enhanced error logging
    console.error("Error in createTeam:", {
      message: error.message,
      stack: error.stack,
      body: req.body,
    });

    res.status(400).json({ error: error.message || "Unknown error occurred" });
  }
};

// function for channel deletion
export const deleteChannel = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { channelId } = req.body;

    if (!channelId) {
      res.status(400).json({ error: "Channel ID is required" });
      return;
    }

    // Archive (delete) the channel
    await slackClient.conversations.archive({
      channel: channelId,
    });

    console.log(`Channel with ID ${channelId} has been archived.`);
    res.status(200).json({
      message: "Channel deleted (archived) successfully",
      channelId,
    });
  } catch (error: any) {
    // Enhanced error logging
    console.error("Error in deleteChannel:", {
      message: error.message,
      stack: error.stack,
    });

    res.status(400).json({ error: error.message });
  }
};

//function required to get all teams
export const getTeams = async (req: Request, res: Response): Promise<void> => {
  try {
    const teams = await Team.find();
    res.json(teams);
  } catch (error: any) {
    // Enhanced error logging
    console.error("Error in getAllTeams:", {
      message: error.message,
      stack: error.stack,
    });

    res.status(400).json({ error: error.message });
  }
};

// Function required to delete a team
export const deleteTeam = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { slackChannelId } = req.params; // Slack channel ID

  try {
    // Attempt to delete the Slack channel associated with the team
    try {
      await slackClient.conversations.archive({ channel: slackChannelId });
    } catch (archiveError: any) {
      if (archiveError.data.error === "not_in_channel") {
        console.warn(
          `Bot is not in the channel ${slackChannelId}, proceeding with team deletion.`
        );
      } else {
        throw archiveError;
      }
    }

    // Find the team by Slack channel ID and delete it
    const team = await Team.findOneAndDelete({
      slackChannelId: slackChannelId,
    });

    if (!team) {
      res
        .status(404)
        .json({ message: `Team with Slack ID ${slackChannelId} not found` });
      return;
    }

    // find all standup responses for that team and delete it
    const standupResponses = await StandupResponse.findOneAndDelete({
      slackChannelId: slackChannelId,
    });

    if (!standupResponses) {
      res.status(200).json({
        message: `Team with Slack ID ${slackChannelId} deleted successfully. No stand up responses found`,
      });
      return;
    } else {
      res.status(404).json({
        message: `Team with SlackId ${slackChannelId} deleted with along with its standup responses`,
      });
    }
  } catch (error: any) {
    // Enhanced error logging
    console.error("Error in deleteTeam:", {
      message: error.message,
      stack: error.stack,
      slackChannelId,
    });
    res.status(500).json({
      error: `Failed to delete team with Slack ID ${slackChannelId}: ${error.message}`,
    });
  }
};

export const generateTeamReport = async (req: Request, res: Response) => {
  try {
    const { slackChannelId } = req.query;

    if (!slackChannelId) {
      res.status(400).json({ error: "slackChannelId is required" });
      return;
    }

    // Get team details
    const team = (await Team.findOne({
      slackChannelId: slackChannelId,
    })) as TeamDocument;
    if (!team) {
      res.status(404).json({ error: "Team not found" });
      return;
    }

    // Get team creation date
    // const teamCreationDate = format(new Date(team.createdAt), "yyyy-MM-dd") || null;

    // Find the first recorded standup for the team
    const firstStandup = await StandupResponse.findOne({ slackChannelId }).sort(
      {
        date: 1,
      }
    );
    if (!firstStandup) {
      res.status(404).json({ error: "No standup data found for this team" });
      return;
    }

    // Get all standup responses for the team
    const standups = await StandupResponse.find({ slackChannelId });

    // Group standups by date
    const participationReport: Record<string, any> = {};
    const standupDays = new Set();
    const activeMembers = new Set();

    standups.forEach((standup) => {
      const date = format(new Date(standup.date), "yyyy-MM-dd");
      standupDays.add(date);
      // activeMembers.add(standup.userId);

      if (!participationReport[date]) {
        participationReport[date] = {
          responded: new Set(),
          missed: new Set(team.members),
        };
      }

      // Add responders
      // participationReport[date].responded.add(standup.userId);
      // participationReport[date].missed.delete(standup.userId);
    });

    // Calculate participation rates
    const reportData = Object.entries(participationReport).map(
      ([date, data]) => {
        const totalMembers = team.members.length;
        const respondedCount = data.responded.size;
        const participationRate =
          totalMembers > 0 ? (respondedCount / totalMembers) * 100 : 0;

        return {
          date,
          totalMembers,
          responded: respondedCount,
          missed: totalMembers - respondedCount,
          participationRate: `${participationRate.toFixed(2)}%`,
        };
      }
    );

    const responsePayload = {
      team: slackChannelId,
      // teamCreationDate,
      totalStandupDays: standupDays.size,
      activeMembers: Array.from(activeMembers),
      report: reportData,
    };

    // JSON Response
    if (req.query.format === "json") {
      res.json(responsePayload);
      return;
    }

    // CSV Response
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="team_report.csv"'
    );

    writeToStream(res, reportData, { headers: true })
      .on("error", (err) => res.status(500).json({ error: err.message }))
      .on("finish", () => res.end());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// UpdateTeam
export const updateTeam = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { slackChannelId, name, members, standUpConfig, timezone } = req.body;

  try {
    // Check if the team exists
    const existingTeam = await Team.findOne({ slackChannelId });
    if (!existingTeam) {
      res.status(404).json({
        error: `Team with slackChannelId ${slackChannelId} not found`,
      });
      return;
    }

    // Create update object with only provided fields
    const updateData: any = {};
    if (name) updateData.name = name;
    if (members) updateData.members = members;
    if (standUpConfig) updateData.standUpConfig = standUpConfig;
    if (timezone) updateData.timezone = timezone;

    // If there's nothing to update
    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: "No valid update fields provided" });
      return;
    }

    // If name is being updated, check if the new name already exists
    if (name && name !== existingTeam.name) {
      const nameExists = await Team.findOne({
        name,
        slackChannelId: { $ne: slackChannelId },
      });
      if (nameExists) {
        res
          .status(400)
          .json({ error: `Team with name ${name} already exists` });
        return;
      }
    }

    // Update team
    const updatedTeam = await Team.findOneAndUpdate(
      { slackChannelId },
      updateData,
      { new: true } // Return the updated document
    );

    // If members are updated, update the Slack channel members
    if (members && members.length > 0) {
      try {
        // Get current channel members
        const channelInfo = await slackClient.conversations.members({
          channel: slackChannelId,
        });

        if (channelInfo.ok && channelInfo.members) {
          // Invite new members
          const newMembers = members.filter(
            (memberId: string) => !channelInfo.members?.includes(memberId)
          );

          if (newMembers.length > 0) {
            await slackClient.conversations.invite({
              channel: slackChannelId,
              users: newMembers.join(","),
            });
          }

          // Remove members that are no longer part of the team
          const removedMembers = channelInfo.members.filter(
            (memberId: string) => !members.includes(memberId)
          );

          for (const memberId of removedMembers) {
            try {
              await slackClient.conversations.kick({
                channel: slackChannelId,
                user: memberId,
              });
            } catch (removalError: any) {
              console.error(
                `Error removing member ${memberId} from Slack channel:`,
                removalError
              );
            }
          }
        }
      } catch (slackError: any) {
        console.error("Error updating Slack channel members:", slackError);
        // Continue with the response as the team update was successful
      }
    }

    res.status(200).json({
      message: "Team updated successfully",
      team: updatedTeam,
    });
  } catch (error: any) {
    console.error("Error in updateTeam:", {
      message: error.message,
      stack: error.stack,
      body: req.body,
    });

    res.status(500).json({
      error: error.message || "An error occurred while updating the team",
    });
  }
};
