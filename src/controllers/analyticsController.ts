import { Request, Response } from "express";
import { StandupResponse } from "../models/StandUpResponses";
import { MoodResponse } from "../models/MoodResponse";
import { Kudos } from "../models/kudos";
import { Poll } from "../models/Poll";
import { Team } from "../models/Team";
import { getStandupStatus } from "./standupController";

export const getMasterAnalytics = async (req: Request, res: Response) => {
  try {
    const { team: name, startDate, endDate } = req.query;

    console.log("data:", name, startDate, endDate);

    const teamFilter = name && name !== "All Teams" ? { name } : {};

    console.log("teamfilter:", teamFilter);

    // Get team IDs for filtering
    const teams = await Team.find(teamFilter).select("slackChannelId");
    console.log("Teams:", teams);
    const teamIds = teams.map((t) => t.slackChannelId);

    console.log("TeamIds:", teamIds);

    // Date filter setup
    const dateFilter: any = {};
    if (startDate) dateFilter.$gte = new Date(startDate as string);
    if (endDate) dateFilter.$lte = new Date(endDate as string);

    console.log("date filter:", dateFilter);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Fetch all data in parallel
    const [standups, moods, kudos, polls] = await Promise.all([
      // Standups
      StandupResponse.aggregate([
        {
          $match: {
            slackChannelId: { $in: teamIds },
            date: Object.keys(dateFilter).length
              ? dateFilter
              : { $exists: true },
          },
        },
        {
          $unwind: {
            path: "$responses",
            preserveNullAndEmptyArrays: true, // Keeps standups even if they have no responses
          },
        },
        {
          $group: {
            _id: "$_id",
            completed: {
              $sum: {
                $cond: [{ $lt: ["$date", today] }, 1, 0], // counting past standups
              },
            },
            pending: {
              $sum: { $cond: [{ $gte: ["$date", today] }, 1, 0] }, // counting today & future standups
            },
            uniqueParticipants: { $addToSet: "$responses.userId" },
          },
        },
        {
          $group: {
            _id: null,
            completed: { $sum: "$completed" },
            pending: { $sum: "$pending" },
            totalUniqueParticipants: { $sum: { $size: "$uniqueParticipants" } }, // Store participant counts
          },
        },
        {
          $project: {
            completed: 1,
            pending: 1,
            avgParticipants: {
              $round: [{ $avg: "$totalUniqueParticipants" }, 1],
            },
          },
        },
      ]),

      // Moods
      MoodResponse.aggregate([
        {
          $match: {
            slackChannelId: { $in: teamIds },
            date: Object.keys(dateFilter).length
              ? dateFilter
              : { $exists: true },
          },
        },
        {
          $facet: {
            counts: [{ $group: { _id: "$mood", count: { $sum: 1 } } }],
            average: [
              {
                $group: {
                  _id: null,
                  avg: {
                    $avg: {
                      $switch: {
                        branches: [
                          { case: { $eq: ["$mood", "happy"] }, then: 2 },
                          { case: { $eq: ["$mood", "neutral"] }, then: 1 },
                          { case: { $eq: ["$mood", "sad"] }, then: 0 },
                        ],
                        default: 1,
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      ]),

      // Kudos
      Kudos.aggregate([
        {
          $match: {
            timestamp: Object.keys(dateFilter).length
              ? dateFilter
              : { $exists: true },
          },
        },
        {
          $facet: {
            total: [{ $count: "given" }],
            topReceiver: [
              { $group: { _id: "$receiverId", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 1 },
            ],
            topCategory: [
              { $group: { _id: "$category", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 1 },
            ],
          },
        },
      ]),

      // Polls
      Poll.aggregate([
        {
          $match: {
            createdAt: Object.keys(dateFilter).length
              ? dateFilter
              : { $exists: true },
          },
        },
        {
          $facet: {
            total: [{ $count: "total" }],
            participation: [
              { $project: { votesCount: { $size: "$votes" } } },
              { $group: { _id: null, avg: { $avg: "$votesCount" } } },
            ],
            popular: [
              { $group: { _id: "$question", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 1 },
            ],
          },
        },
      ]),
    ]);

    const standupTrends = await StandupResponse.aggregate([
      {
        $match: {
          slackChannelId: { $in: teamIds },
          date: Object.keys(dateFilter).length ? dateFilter : { $exists: true },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const moodCounts: any[] = moods[0]?.counts || [];
    const avgMood = moods[0]?.average?.[0]?.avg || 0;

    console.log("kudos:", JSON.stringify(kudos));

    // Format the data
    const response = {
      standups: {
        completed: standups[0]?.completed || 0,
        pending: standups[0]?.pending || 0, // Would need additional status data
        avgParticipants: standups[0]?.avgParticipants || 0,
        trends: standupTrends,
      },
      moods: {
        happy: moodCounts.find((m) => m._id === "happy")?.count || 0,
        neutral: moodCounts.find((m) => m._id === "neutral")?.count || 0,
        sad: moodCounts.find((m) => m._id === "sad")?.count || 0,
        avgMood,
      },
      kudos: {
        given: kudos[0]?.total?.[0]?.given || 0,
        topReceiver: kudos[0]?.topReceiver || "",
        topCategory: kudos[0]?.topCategory || "",
      },
      polls: {
        total: polls[0]?.total || 0,
        avgParticipation: polls[0]?.participation || 0,
        mostPopular: polls[0]?.popular || "",
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
