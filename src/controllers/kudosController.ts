import { Request, Response } from "express";
import { Kudos } from "../models/kudos";
import { slackApp } from "../config/slack";

export const giveKudos = async (req: Request, res: Response) => {
    try {
      const { giverId, receiverId, category, reason, teamName } = req.body;
  
      if (!giverId || !receiverId || !category || !reason || teamName) {
        res.status(400).json({ error: "All fields are required" });
        return;
      }

      console.log("data:", teamName)

      // 🚫 REMOVE DAILY LIMIT CHECK FOR TESTING
      // const today = new Date();
      // today.setHours(0, 0, 0, 0);
      // const kudosCount = await Kudos.countDocuments({
      //   giverId,
      //   timestamp: { $gte: today },
      // });
      // if (kudosCount >= 3) {
      //   res.status(403).json({ message: "You have reached your daily limit of 3 kudos." });
      //   return;
      // }

      const newKudos = await Kudos.create({ giverId, receiverId, category, reason, teamName });

      // 🟢 Send Kudos Notification to Slack
      await slackApp.client.chat.postMessage({
        channel: receiverId, // Ensure this is a valid Slack user ID
        text: `🎉 <@${giverId}> just gave you kudos for *${category}*! 🎯\n\n"${reason} in team <|>"`,
      });

      // Notify the giver (no limit message)
      await slackApp.client.chat.postMessage({
        channel: giverId,
        text: `✅ Kudos sent successfully!`,
      });

      res.status(201).json({ message: "Kudos sent successfully!", kudos: newKudos });

    } catch (error) {
      console.error("Error giving kudos:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
};
// ✅ Function to Get Kudos (with filtering)
export const getKudos = async (req: Request, res: Response) => {
    try {
      const { teamMember, category, startDate, endDate } = req.query;
  
      const filters: any = {};
      if (teamMember) filters.$or = [{ giverId: teamMember }, { receiverId: teamMember }];
      if (category) filters.category = category;
      if (startDate && endDate) {
        filters.timestamp = { $gte: new Date(startDate as string), $lte: new Date(endDate as string) };
      }
  
      const kudos = await Kudos.find(filters).sort({ timestamp: -1 });
  
      // // Fetch user details from Slack API
      // const fetchSlackUser = async (userId: string) => {
      //   try {
      //     const response = await slackApp.client.users.info({ user: userId });
      //     return response.user?.real_name || "Unknown User";
      //   } catch (error) {
      //     console.error(`Error fetching Slack user ${userId}:`, error);
      //     return "Unknown User";
      //   }
      // };
  
      // // Map kudos and replace user IDs with names
      // const kudosWithNames = await Promise.all(
      //   kudos.map(async (kudo) => ({
      //     ...kudo.toObject(),
      //     giver: {
      //       id: kudo.giverId,
      //       name: await fetchSlackUser(kudo.giverId),
      //     },
      //     receiver: {
      //       id: kudo.receiverId,
      //       name: await fetchSlackUser(kudo.receiverId),
      //     },
      //   }))
      // );
  
      res.status(200).json(kudos);
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
          { $limit: 10 }
      ]);

      // Fetch Slack user names for each receiverId
      const fetchSlackUser = async (userId: string) => {
          try {
              const response = await slackApp.client.users.info({ user: userId });
              return response.user?.real_name || "Unknown User";
          } catch (error) {
              console.error(`Error fetching Slack user ${userId}:`, error);
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
