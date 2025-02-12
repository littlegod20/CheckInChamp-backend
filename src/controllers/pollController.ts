import { Request, Response } from "express";
import { Poll } from "../models/Poll";
import { Team } from "../models/Team";
import { Member } from "../models/Member";
import axios from "axios";

export const getPollDetails = async (req: Request, res: Response) => {
  try {
    const { pollId } = req.params;
    const poll = await Poll.findById(pollId);

    if (!poll) {
      res.status(404).json({ error: "Poll not found" });
      return;
    }

    // Fetch creator's username
    const creator = await Member.findOne({ slackId: poll.createdBy });
    const creatorName = creator ? creator.name : "Unknown";

    // Fetch voter details and map selectedOptions to actual option names
    const votesWithUsernames = await Promise.all(
      poll.votes.map(async (vote) => {
        if (poll.anonymous) {
          return {
            username: "Anonymous",
            selectedOptions: vote.selectedOptions.join(", "),
          };
        }
        const member = await Member.findOne({ slackId: vote.userId });

        // Map selectedOptions (index) to actual option names
        const selectedOptions = vote.selectedOptions
          .map((index) => poll.options[Number(index)]) // ✅ Convert to Number
          .filter(Boolean); // ✅ Remove undefined values

        return {
          username: member ? member.name : "Unknown",
          selectedOptions: selectedOptions.join(", "), // Convert array to string
        };
      })
    );

    res.status(200).json({
      ...poll.toObject(),
      createdByName: creatorName,
      votes: votesWithUsernames,
    });
  } catch (error) {
    console.error("Error fetching poll details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ✅ Create Poll
// ✅ Extract poll creation logic into a function
export const createPollService = async (pollData: {
  question: string;
  options: string[];
  type: string;
  createdBy: string;
  anonymous: boolean;
  channelId: string;
  // Add channelId to the parameters
}) => {
  const { question, options, type, createdBy, anonymous, channelId } = pollData;

  if (!question || !options || !type || !createdBy || !channelId) {
    throw new Error("All fields are required");
  }

  const newPoll = new Poll({
    question,
    options,
    type,
    createdBy,
    anonymous,
    channelId,
  });
  await newPoll.save();
  return newPoll;
};

// ✅ Express API Handler
export const createPoll = async (req: Request, res: Response) => {
  try {
    const newPoll = await createPollService(req.body);
    res
      .status(201)
      .json({ message: "Poll created successfully", poll: newPoll });
    return;
  } catch (error: Error | any) {
    console.error("Error creating poll:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
    return;
  }
};
// ✅ Vote on a Poll
export const votePoll = async (req: Request, res: Response) => {
  try {
    const { pollId } = req.params;
    const { userId, selectedOptions, scaleValue } = req.body;

    if (!userId || (!selectedOptions && scaleValue === undefined)) {
      res.status(400).json({ error: "Invalid vote data" });
      return;
    }

    const poll = await Poll.findById(pollId);
    if (!poll) {
      res.status(404).json({ error: "Poll not found" });
      return;
    }

    const existingVote = poll.votes.find((vote) => vote.userId === userId);
    if (existingVote) {
      res.status(400).json({ error: "User has already voted" });
      return;
    }

    poll.votes.push({ userId, selectedOptions, scaleValue });
    await poll.save();

    res.status(200).json({ message: "Vote recorded successfully", poll });
    return;
  } catch (error) {
    console.error("Error voting on poll:", error);
    res.status(500).json({ error: "Internal Server Error" });
    return;
  }
};

// ✅ Get Poll Results (Real-time)
export const getPollResults = async (req: Request, res: Response) => {
  try {
    const { pollId } = req.params;
    const poll = await Poll.findById(pollId);

    if (!poll) {
      res.status(404).json({ error: "Poll not found" });
      return;
    }

    const results = poll.options.map((option) => ({
      option,
      votes: poll.votes.filter((vote) => vote.selectedOptions?.includes(option))
        .length,
    }));

    res.status(200).json({ poll, results });
    return;
  } catch (error) {
    console.error("Error fetching poll results:", error);
    res.status(500).json({ error: "Internal Server Error" });
    return;
  }
};

// ✅ Import the Team model

export const getAllPolls = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const teamName = (req.query.teamName as string) || "";
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const skip = (page - 1) * limit;

    // building query
    const query: any = {};

    // Team filter
    if (teamName) {
      console.log("teamName:", teamName);
      const teams = await Team.find({ name: new RegExp(teamName, "i") });
      console.log("teams:", teams);
      const channelIds = teams.map((team) => team.name);

      console.log("channelIds:", channelIds);
      if (channelIds.length > 0) {
        query.channelId = { $in: channelIds };
      }
    }

    // Date filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    console.log("query:", query);

    // Get paginated polls
    const [polls, total] = await Promise.all([
      Poll.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
      Poll.countDocuments(query),
    ]);

    console.log("polls & total:", polls, total);

    // Add team names
    const pollsWithTeamNames = await Promise.all(
      polls.map(async (poll) => {
        const team = await Team.findOne({ slackChannelId: poll.channelId });
        return { ...poll, teamName: team?.name || poll.channelId };
      })
    );

    res.status(200).json({
      polls: pollsWithTeamNames,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching polls:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
