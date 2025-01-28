import { Request, Response } from "express";
import { Member } from "../models/Member";
import { Team } from "../models/Team";
// import { WebClient } from '@slack/web-api';
// const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
import { redisClient } from "../config/redis";

import { web as slackClient } from "../config/slack";
import schedule from "node-schedule";

//function to  add member to a team
export const addMembers = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { members } = req.body; // Expecting an array of members
  const { teamId } = req.params;

  if (!Array.isArray(members)) {
    res
      .status(400)
      .json({ error: 'Invalid request body. "members" should be an array.' });
    return;
  }

  try {
    const slackChannelId = teamId;
    const teamUpdates: any[] = []; // To keep track of successful updates

    for (const member of members) {
      const { name, id } = member;

      if (!name || !id) {
        res
          .status(400)
          .json({ error: 'Each member must have "name" and "id".' });
        return;
      }

      try {
        // Invite the member to the Slack channel
        await slackClient.conversations.invite({
          channel: slackChannelId,
          users: id,
        });

        // Update the team in the database
        const team = await Team.findOneAndUpdate(
          { slackChannelId: teamId },
          { $push: { members: id } },
          { new: true }
        );

        if (!team) {
          throw new Error(`Team with Slack ID ${teamId} not found`);
        }

        teamUpdates.push({ name, id });

        // Send a message to the newly added member
        await slackClient.chat.postMessage({
          channel: id,
          text: `Hi ${name}, you have been successfully added to the team: ${team.name}. Welcome! 🎉`,
        });
      } catch (inviteError: any) {
        if (inviteError.data.error === "already_in_channel") {
          console.warn(`User ${id} is already in the channel.`);
        } else {
          throw inviteError;
        }
      }
    }

    res.status(201).json({
      message: "Members added successfully",
      addedMembers: teamUpdates,
    });
  } catch (error: any) {
    console.error("Error in addMembers:", {
      message: error.message,
      stack: error.stack,
    });

    res.status(400).json({ error: error.message || "Unknown error occurred" });
  }
};

//get all members from the workspace
export const getAllUsers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    let allUsers: any = [];

    //get all members from the redis cache with tag slackUser
    const keys = await redisClient.keys("*");
    for (const key of keys) {
      if (key.startsWith("slackUser:")) {
        const value = await redisClient.get(key);
        allUsers.push({ id: key.split(":")[1], name: value });
      }
    }

    res.status(200).json({ users: allUsers });
  } catch (error: any) {
    console.error("Error in getAllUsers:", {
      message: error.message,
      stack: error.stack,
    });

    res.status(400).json({ error: error.message || "Unknown error occurred" });
  }
};

//get all members from a team
export const getMembers = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { teamId } = req.params;
  console.log(`Team ID: ${teamId}`);

  try {
    // Find the team in your database
    const team = await Team.findOne({ slackChannelId: teamId }).populate(
      "members"
    );
    console.log(`Team: ${team}`);

    if (!team) {
      console.log(`Team not found`);
      res.status(404).json({ error: "Team not found" });
      return;
    }

    // Fetch channel members from Slack API
    const response = await slackClient.conversations.members({
      channel: teamId,
    });
    console.log(`Slack API response: ${response}`);

    const slackMemberIds = response.members;
    console.log(`Slack member IDs: ${slackMemberIds}`);

    if (!slackMemberIds) {
      console.log(`No members found`);
      res.status(404).json({ error: "No members found in the Slack channel" });
      return;
    }

    // Respond with the team's name and Slack members
    res.status(200).json({ name: team.name, members: slackMemberIds });
  } catch (error: any) {
    console.error(`Error fetching channel members: ${error}`);
    res.status(400).json({ error: error.message });
  }
};
//function to remove slack members from a team by their id
export const removeMember = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { teamId, memberId } = req.params; // Ensure these are sent in the request body

  try {
    // Use Slack API to kick the user from the channel
    await slackClient.conversations.kick({
      channel: teamId,
      user: memberId,
    });

    // Update the team in the database
    const team = await Team.findOneAndUpdate(
      { slackChannelId: teamId },
      { $pull: { members: memberId } },
      { new: true }
    );

    if (!team) {
      throw new Error(`Team with Slack ID ${teamId} not found`);
    }

    // Send a message to the newly added member
    await slackClient.chat.postMessage({
      channel: memberId,
      text: `You have been removed from the team: ${team.name}.`,
    });

    res.status(200).json({
      message: `User ${memberId} has been removed from channel ${teamId} and the team.`,
    });
  } catch (error: any) {
    console.error("Error removing user from channel:", error);
    res.status(400).json({ error: error.message });
  }
};

//sending reminders to a team member
export function scheduleMemberReminder(
  channel: string,
  text: string,
  scheduleTime: Date,
  memberId: string
): void {
  schedule.scheduleJob(scheduleTime, async () => {
    try {
      const member = await Member.findById(memberId);
      if (!member) {
        throw new Error(`Member with ID ${memberId} not found`);
      }

      const result = await slackClient.chat.postMessage({
        channel,
        text: `${member.name}, ${text}`,
      });
      console.log(`Reminder sent to channel ${channel}:`, result);
    } catch (error) {
      console.error(`Failed to send reminder to channel ${channel}:`, error);
    }
  });
}
