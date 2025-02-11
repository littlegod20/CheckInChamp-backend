import { Request, Response } from "express";
import { Kudos } from "../models/kudos";
import { slackApp } from "../config/slack";
import { Member } from "../models/Member";
import { IMember } from "../types/MemberTypes";

export const giveKudos = async (req: Request, res: Response) => {
  try {
    const { giverId, receiverId, category, reason, teamName } = req.body;

    if (!giverId || !receiverId || !category || !reason || !teamName) {
      console.log("Error");
      res.status(400).json({ error: "All fields are required" });
      return;
    }

    console.log("data:", giverId, receiverId, category, reason, teamName);
    const giver = (await Member.findOne({ name: giverId })) as IMember;
    const receiver = (await Member.findOne({ name: receiverId })) as IMember;

    if (!giver || !receiver) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    console.log("giver & receiver:", giver, receiver);

    const newKudos = await Kudos.create({
      giverId,
      receiverId,
      category,
      reason,
      teamName: teamName,
    });

    console.log("ids:", giver, receiver);

    const emojiMap: { [key: string]: string } = {
      teamwork: "🎯",
      creativity: "💡",
      leadership: "🦸",
    };

    const categoryEmoji = emojiMap[category] || "⭐"; // Default emoji if category not found
    const kudosMessage = `🎉 <@${giverId}> just gave you kudos for *${categoryEmoji} ${category}*! \n\n"${reason}"`;

    console.log("receiverId:", receiverId);

    // 🟢 Send Kudos Notification to Slack
    await slackApp.client.chat.postMessage({
      channel: receiver.slackId, // Send to the receiver
      text: kudosMessage,
    });

    // Notify the giver (no limit message)
    await slackApp.client.chat.postMessage({
      channel: giver.slackId,
      text: `✅ Kudos sent successfully!`,
    });

    res
      .status(201)
      .json({ message: "Kudos sent successfully!", kudos: newKudos });
  } catch (error) {
    // console.error("Error giving kudos:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
// ✅ Function to Get Kudos (with filtering)
export const getKudos = async (req: Request, res: Response) => {
  try {
    const {
      teamMember,
      category,
      startDate,
      endDate,
      limit = 5,
      page = 1,
    } = req.query;

    console.log("req.query:", req.query);

    const filters: any = {};
    if (teamMember)
      filters.$or = [{ giverId: teamMember }, { receiverId: teamMember }];
    if (category) filters.category = category;
    if (startDate && endDate) {
      filters.timestamp = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    // converting page and limit to numbers
    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);

    // calculate the number of documents to skip
    const skip = (pageNumber - 1) * limitNumber;

    // fetch total count of documents for pagination metadata
    const total = await Kudos.countDocuments(filters);

    const kudos = await Kudos.find(filters).skip(skip).limit(limitNumber);

    // Calculate total pages
    const totalPages = Math.ceil(total / limitNumber);

    res.status(200).json({
      kudos,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching kudos:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
// ✅ Function to Get Monthly Leaderboard
export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    // Get the first day of the current month at 00:00:00
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Get the current date and time
    const now = new Date();

    // Aggregate kudos received within the entire month
    const leaderboard = await Kudos.aggregate([
      { $match: { timestamp: { $gte: startOfMonth, $lte: now } } },
      { $group: { _id: "$receiverId", kudosCount: { $sum: 1 } } },
      { $sort: { kudosCount: -1 } },
      { $limit: 10 },
    ]);

    // Fetch Slack user names for each receiverId
    const fetchSlackUser = async (userName: string) => {
      try {
        console.log("userName:", userName);

        const userId = await Member.findOne({ name: userName });

        if (!userId) {
          throw new Error(`No user id found for ${userName}`);
        }

        const response = await slackApp.client.users.info({
          user: userId.slackId,
        });
        return response.user?.real_name || "Unknown User";
      } catch (error) {
        console.error(`Error fetching Slack user ${userName}:`, error);
        return "Unknown User";
      }
    };

    // Replace receiverId with actual Slack user names
    const leaderboardWithNames = await Promise.all(
      leaderboard.map(async (entry, index) => ({
        rank: index + 1, // Assign ranking based on position
        userId: entry._id,
        name: await fetchSlackUser(entry._id),
        kudosCount: entry.kudosCount,
      }))
    );

    res.status(200).json(leaderboardWithNames);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
