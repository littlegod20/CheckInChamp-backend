import { Request, Response } from "express";
import { Poll } from "../models/Poll";

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

    const newPoll = new Poll({ question, options, type, createdBy, anonymous, channelId });
    await newPoll.save();
    return newPoll;
};

// ✅ Express API Handler
export const createPoll = async (req: Request, res: Response) => {
    try {
        const newPoll = await createPollService(req.body);
        res.status(201).json({ message: "Poll created successfully", poll: newPoll });
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
        votes: poll.votes.filter((vote) => vote.selectedOptions?.includes(option)).length,
      }));
  
       res.status(200).json({ poll, results });
        return;
    } catch (error) {
      console.error("Error fetching poll results:", error);
       res.status(500).json({ error: "Internal Server Error" });
       return
    }
  };

//   export const saveVoteToDB = async ({ pollId, userId, vote }: { pollId: string, userId: string, vote: string }) => {
//     try {
//         await PollVoteModel.create({ pollId, userId, vote }); // Save to DB
//         console.log(`✅ Vote saved: Poll ${pollId}, User ${userId}, Vote ${vote}`);
//     } catch (error) {
//         console.error("❌ Error saving vote:", error);
//     }
// };
