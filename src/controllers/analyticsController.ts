import { Request, Response } from "express";
import { StandupResponse } from "../models/StandUpResponses";
import { MoodResponse } from "../models/MoodResponse";
import { Kudos } from "../models/kudos";
import { Poll } from "../models/Poll";
import { Team } from "../models/Team";
import { fetchSlackUser } from "../helpers/fetchSlackUser";
import jsPDF from "jspdf";

export const getMasterAnalytics = async (req: Request, res: Response) => {
  try {
    const { team: name, startDate, endDate } = req.query;

    // console.log("data:", name, startDate, endDate);

    const teamFilter = name && name !== "All Teams" ? { name } : {};

    // console.log("teamfilter:", teamFilter);

    // Get team IDs for filtering
    const teams = await Team.find(teamFilter).select("slackChannelId");
    console.log("Teams:", teams);
    const teamIds = teams.map((t) => t.slackChannelId);

    const teamName = await Team.find(teamFilter).select("name");
    const names = teamName.map((t) => t.name);

    console.log("names:", names);
    // console.log("TeamIds:", teams);

    // Recent Activities Query
    const recentActivities = await getRecentActivities(
      name?.toString(),
      startDate?.toString(),
      endDate?.toString()
    );

    // Date filter setup
    const dateFilter: any = {};
    if (startDate) dateFilter.$gte = new Date(startDate as string);
    if (endDate) dateFilter.$lte = new Date(endDate as string);

    // console.log("date filter:", dateFilter);
    const teamComparison = await getTeamComparisonData(
      names as string[],
      dateFilter
    );

    // console.log("comparison:", teamComparison);
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
          date: Object.keys(dateFilter).length
            ? {
                $gte: new Date(new Date(dateFilter.start).setHours(0, 0, 0, 0)), // Start of day
                $lt: new Date(
                  new Date(dateFilter.end).setHours(23, 59, 59, 999)
                ), // End of day
              }
            : { $exists: true },
        },
      },
      {
        $lookup: {
          from: "moodresponses",
          let: {
            standupDate: {
              $dateToString: { format: "%Y-%m-%d", date: "$date" },
            },
          }, // Normalize standup date
          pipeline: [
            {
              $addFields: {
                moodDate: {
                  $dateToString: { format: "%Y-%m-%d", date: "$date" },
                }, // Normalize mood response date
              },
            },
            {
              $match: {
                $expr: { $eq: ["$moodDate", "$$standupDate"] }, // Compare dates
              },
            },
          ],
          as: "moods",
        },
      },
      {
        $unwind: {
          path: "$moods",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          standupCount: { $sum: 1 }, // Total standups per day
          completedStandups: { $sum: 1 }, // All standups count as completed
          moodCounts: {
            $push: "$moods.mood", // Collect moods
          },
        },
      },
      {
        $project: {
          date: "$_id",
          standupCount: 1,
          completedStandups: 1,
          moodDistribution: {
            happy: {
              $size: {
                $filter: {
                  input: "$moodCounts",
                  as: "m",
                  cond: { $eq: ["$$m", "happy"] },
                },
              },
            },
            neutral: {
              $size: {
                $filter: {
                  input: "$moodCounts",
                  as: "m",
                  cond: { $eq: ["$$m", "neutral"] },
                },
              },
            },
            sad: {
              $size: {
                $filter: {
                  input: "$moodCounts",
                  as: "m",
                  cond: { $eq: ["$$m", "sad"] },
                },
              },
            },
          },
        },
      },
      { $sort: { date: 1 } },
    ]);

    const [kudosTrends, pollTrends] = await Promise.all([
      Kudos.aggregate([
        {
          $match: {
            timestamp: Object.keys(dateFilter).length
              ? {
                  $gte: new Date(new Date(dateFilter).setHours(0, 0, 0, 0)), // Start of the day
                  $lt: new Date(new Date(dateFilter).setHours(23, 59, 59, 999)), // End of the day
                }
              : { $exists: true },
            teamName: { $in: names },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      Poll.aggregate([
        {
          $match: {
            createdAt: Object.keys(dateFilter).length
              ? {
                  $gte: new Date(new Date(dateFilter).setHours(0, 0, 0, 0)), // Start of the day
                  $lt: new Date(new Date(dateFilter).setHours(23, 59, 59, 999)), // End of the day
                }
              : { $exists: true },
            channelId: { $in: names },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    console.log("kudos Trends:", kudosTrends);
    // console.log("standup Trends:", standupTrends);

    const moodCounts: any[] = moods[0]?.counts || [];
    const avgMood = moods[0]?.average?.[0]?.avg || 0;

    // console.log("recents:", JSON.stringify(recentActivities));

    // Format the data
    const response = {
      standups: {
        completed: standups[0]?.completed || 0,
        pending: standups[0]?.pending || 0,
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
        trends: kudosTrends,
      },
      polls: {
        total: polls[0]?.total || 0,
        avgParticipation: polls[0]?.participation || 0,
        mostPopular: polls[0]?.popular || "",
        trends: pollTrends.map((t) => t.count),
      },
      recentActivities,
    };

    res.status(200).json({ ...response, teamComparison });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getRecentActivities = async (
  team?: string,
  startDate?: string,
  endDate?: string
) => {
  const filter: Record<string, any> = {};

  if (team && team !== "All Teams") {
    filter.teamName = team;
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const [standups, kudos, polls] = await Promise.all([
    StandupResponse.find(filter.createdAt ? { date: filter.createdAt } : {})
      .sort({ date: -1 })
      .limit(2),
    Kudos.find(filter.createdAt ? { timestamp: filter.createdAt } : {})
      .sort({ timestamp: 1 })
      .limit(2)
      .populate("giverId", "receiverId"),
    Poll.find(filter.createdAt ? { createdAt: filter.createdAt } : {})
      .sort({ createdAt: -1 })
      .limit(2),
  ]);

  // Process standups with user names
  const processedStandups = await Promise.all(
    standups.map(async (s) => {
      try {
        // Get all user names first
        const userNames = await Promise.all(
          s.responses.map(async (item) => {
            try {
              return await fetchSlackUser(item.userId);
            } catch (error) {
              console.error(`Error fetching user ${item.userId}:`, error);
              return "Unknown User";
            }
          })
        );

        // Format the display string
        let usersDisplay = "none";
        if (userNames.length > 0) {
          console.log("users:", userNames);

          const visibleUsers = userNames.slice(0, 2);
          const extraCount = userNames.length - visibleUsers.length;

          usersDisplay = visibleUsers.join(", ");
          if (extraCount > 0) {
            usersDisplay += ` and ${extraCount} other${
              extraCount > 1 ? "s" : ""
            }`;
          }
        }

        return {
          type: "standup" as const,
          teamId: s?.teamName,
          date: s?.date.toISOString(),
          details: `Standup completed by ${usersDisplay}`,
        };
      } catch (error) {
        console.error("Error processing standup:", error);
        return {
          type: "standup" as const,
          teamId: s?.teamName,
          date: s?.date.toISOString(),
          details: "Standup completed by unknown members",
        };
      }
    })
  );

  // Process other activities
  const activities = [
    ...processedStandups,
    ...kudos.map((k) => ({
      type: "kudos" as const,
      teamId: k?.teamName,
      date: k?.timestamp.toISOString(),
      details: `${k?.giverId} gave kudos to ${k?.receiverId}`,
    })),
    ...polls.map((p) => ({
      type: "poll" as const,
      teamId: p.channelId,
      date: p.createdAt.toISOString(),
      details: `New poll created: ${p.question}`,
    })),
  ];

  return activities.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
};

const getTeamComparisonData = async (teamIds: string[], dateFilter: any) => {
  const [kudosComparison, pollsComparison] = await Promise.all([
    // Kudos Comparison
    Kudos.aggregate([
      {
        $match: {
          timestamp: Object.keys(dateFilter).length
            ? dateFilter
            : { $exists: true },
        },
      },
      {
        $group: {
          _id: "$teamName",
          kudos: { $sum: 1 },
        },
      },
    ]),

    // Polls Comparison
    Poll.aggregate([
      {
        $match: {
          createdAt: Object.keys(dateFilter).length
            ? dateFilter
            : { $exists: true },
        },
      },
      {
        $group: {
          _id: "$channelId",
          polls: { $sum: 1 },
        },
      },
    ]),
  ]);

  console.log("comparision kuods:", kudosComparison);
  // Combine results into a unified comparison array
  const comparisonData = teamIds.map((teamId) => {
    const kudosData = kudosComparison.find((k) => k._id === teamId) || {
      kudos: 0,
    };
    console.log("kudos:", JSON.stringify(kudosComparison));
    const pollsData = pollsComparison.find((p) => p._id === teamId) || {
      polls: 0,
    };
    return {
      team: teamId,
      kudos: kudosData.kudos,
      polls: pollsData.polls,
    };
  });

  return comparisonData;
};

export const exportAnalytics = async (req: Request, res: Response) => {
  try {
    const { team, startDate, endDate, metrics, format } = req.query;

    // Validate format
    if (format !== "pdf" && format !== "csv") {
      res.status(400).json({ error: "Invalid export format" });
      return;
    }

    // Get the data
    const analyticsData = await getMasterAnalyticsData(
      team?.toString(),
      startDate?.toString(),
      endDate?.toString()
    );

    // Filter data based on selected metrics
    const filteredData = filterDataByMetrics(
      analyticsData,
      metrics?.toString().split(",")
    );

    if (format === "csv") {
      exportAsCSV(filteredData, res);
      return;
    } else {
      exportAsPDF(filteredData, res);
      return;
    }
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Export failed" });
  }
};

const filterDataByMetrics = (data: any, metrics: string[] = []) => {
  const result: any = {};

  if (metrics.includes("standups")) {
    result.standups = {
      completed: data.standups.completed,
      pending: data.standups.pending,
      avgParticipants: data.standups.avgParticipants,
      trends: JSON.stringify(data.standups.trends.flat()),
    };
  }
  if (metrics.includes("moods")) {
    result.moods = data.moods;
  }
  if (metrics.includes("kudos")) {
    result.kudos = JSON.stringify(data.kudos);
  }
  if (metrics.includes("polls")) {
    result.polls = JSON.stringify(data.polls);
  }

  console.log("results:", result);

  return result;
};

const exportAsCSV = (data: any, res: Response) => {
  try {
    // Convert data to CSV format
    const csvData = convertToCSV(data);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=analytics-report.csv"
    );
    return res.send(csvData);
  } catch (error) {
    throw error;
  }
};

const convertToCSV = (data: any) => {
  const headers = Object.keys(data);
  const rows = headers.map((header) => {
    if (Array.isArray(data[header])) {
      return data[header]
        .map((item: any) => Object.values(item).join(","))
        .join("\n");
    }
    return Object.values(data[header]).join(",");
  });

  return headers.join(",") + "\n" + rows.join("\n");
};

const exportAsPDF = async (data: any, res: Response) => {
  try {
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(20);
    doc.text("Analytics Report", 15, 20);

    // Add data sections
    let yPosition = 30;
    Object.entries(data).forEach(([key, value]) => {
      doc.setFontSize(14);
      doc.text(`${key.toUpperCase()}`, 15, yPosition);
      yPosition += 10;

      if (Array.isArray(value)) {
        value.forEach((item: any) => {
          doc.setFontSize(12);
          doc.text(JSON.stringify(item, null, 2), 20, yPosition);
          yPosition += 10;
        });
      } else {
        doc.setFontSize(12);
        doc.text(JSON.stringify(value, null, 2), 20, yPosition);
        yPosition += 10;
      }
      yPosition += 5;
    });

    // Send PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=analytics-report.pdf"
    );
    return res.send(Buffer.from(doc.output("arraybuffer")));
  } catch (error) {
    throw error;
  }
};

// for team insights
export const getMasterAnalyticsData = async (
  team?: string,
  startDate?: string,
  endDate?: string
) => {
  try {
    const teamFilter = team && team !== "All Teams" ? { name: team } : {};

    // console.log("teamfilter:", teamFilter);

    // Get team IDs for filtering
    const teams = await Team.find(teamFilter).select("slackChannelId");
    console.log("Teams:", teams);
    const teamIds = teams.map((t) => t.slackChannelId);

    const teamName = await Team.find(teamFilter).select("name");
    const names = teamName.map((t) => t.name);

    // console.log("TeamIds:", teams);

    // Recent Activities Query
    const recentActivities = await getRecentActivities(
      team?.toString(),
      startDate?.toString(),
      endDate?.toString()
    );

    // Date filter setup
    const dateFilter: any = {};
    if (startDate) dateFilter.$gte = new Date(startDate as string);
    if (endDate) dateFilter.$lte = new Date(endDate as string);

    // console.log("date filter:", dateFilter);
    const teamComparison = await getTeamComparisonData(
      names as string[],
      dateFilter
    );

    // console.log("comparison:", teamComparison);
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
            totalUniqueParticipants: {
              $sum: { $size: "$uniqueParticipants" },
            }, // Store participant counts
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
          date: Object.keys(dateFilter).length
            ? {
                $gte: new Date(new Date(dateFilter).setHours(0, 0, 0, 0)), // Start of the day
                $lt: new Date(new Date(dateFilter).setHours(23, 59, 59, 999)), // End of the day
              }
            : { $exists: true },
        },
      },
      {
        $lookup: {
          from: "moodresponses",
          let: {
            standupDate: {
              $dateToString: { format: "%Y-%m-%d", date: "$date" },
            },
          }, // Normalize standup date
          pipeline: [
            {
              $addFields: {
                moodDate: {
                  $dateToString: { format: "%Y-%m-%d", date: "$date" },
                }, // Normalize mood response date
              },
            },
            {
              $match: {
                $expr: { $eq: ["$moodDate", "$$standupDate"] }, // Compare dates
              },
            },
          ],
          as: "moods",
        },
      },
      {
        $unwind: {
          path: "$moods",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          standupCount: { $sum: 1 }, // Total standups per day
          completedStandups: {
            $sum: { $cond: [{ $eq: ["$completed", true] }, 1, 0] }, // Count completed standups
          },
          moodCounts: {
            $push: "$moods.mood", // Collect moods
          },
        },
      },
      {
        $project: {
          date: "$_id",
          standupCount: 1,
          completedStandups: 1,
          moodDistribution: {
            happy: {
              $size: {
                $filter: {
                  input: "$moodCounts",
                  as: "m",
                  cond: { $eq: ["$$m", "happy"] },
                },
              },
            },
            neutral: {
              $size: {
                $filter: {
                  input: "$moodCounts",
                  as: "m",
                  cond: { $eq: ["$$m", "neutral"] },
                },
              },
            },
            sad: {
              $size: {
                $filter: {
                  input: "$moodCounts",
                  as: "m",
                  cond: { $eq: ["$$m", "sad"] },
                },
              },
            },
          },
        },
      },
      { $sort: { date: 1 } },
    ]);

    const moodCounts: any[] = moods[0]?.counts || [];
    const avgMood = moods[0]?.average?.[0]?.avg || 0;

    const response = {
      standups: {
        completed: standups[0]?.completed || 0,
        pending: standups[0]?.pending || 0,
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
      recentActivities,
    };

    return response;
  } catch (error) {
    console.error("Error fetching analytics:", error);
  }
};
