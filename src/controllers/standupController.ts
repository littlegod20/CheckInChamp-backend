import { format as csvFormat, writeToStream } from "@fast-csv/format";
import { format } from "date-fns";
import { Request, Response } from "express";
import { Team } from "../models/Team";
import { StandupResponse } from "../models/StandUpResponses";

// Filter standups by team or date or user or all three by extracting from query
export const getStandupsByFilterOrAll = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { slackChannelId, date, userId } = req.query;
  try {
    const query: any = {};
    if (slackChannelId) query.slackChannelId = slackChannelId;
    if (date) query.date = new Date(date as string).toISOString().split("T")[0];
    if (userId) query.userId = userId;

    console.log("Slackchannel Id:", slackChannelId);
    console.log("query:", query);
    // Fetch standups based on filters
    const standups = await StandupResponse.find(query);

    console.log("Standupjjjs:", standups);

    // Fetch the status for each standup in parallel
    const statusPromises = standups.map((standup) =>
      getStandupStatus(standup.slackChannelId, standup.date)
    );
    const statuses = await Promise.all(statusPromises);

    res.status(200).json({ standups, statuses });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// Track who responded and who missed the standup and participation rate per day
export const getStandupStatus = async (slackChannelId: string, date: Date) => {
  try {
    if (!slackChannelId) {
      return { error: "slackChannelId is required" };
    }

    const selectedDate = date
      ? new Date(date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    // Find all standup responses for the selected date
    const standups = await StandupResponse.find({
      slackChannelId,
      date: selectedDate,
    });

    // Extract user IDs of those who responded
    const respondedUserIds = standups.map((standup) => standup.userId);

    // Get the team and its members
    const team = await Team.findOne({ slackChannelId: slackChannelId }).select(
      "members"
    );
    console.log("ChannelId:", slackChannelId);
    console.log("Team:", team);
    if (!team) {
      return { error: "Team not found" };
    }

    const totalMembers = team.members.length;
    const totalRespondents = respondedUserIds.length;
    const participationRate =
      totalMembers > 0 ? (totalRespondents / totalMembers) * 100 : 0;

    // Separate responders and non-responders
    const responders = team.members
      .filter((member: any) => respondedUserIds.includes(member))
      .map((member: any) => ({
        userId: member,
        status: "responded",
      }));

    const nonResponders = team.members
      .filter((member: any) => !respondedUserIds.includes(member))
      .map((member: any) => ({
        userId: member,
        status: "missed",
      }));

    const stats = {
      slackChannelId: slackChannelId,
      date: selectedDate,
      participationRate: participationRate.toFixed(2) + "%",
      status: [...responders, ...nonResponders],
    };

    return stats;
  } catch (error: any) {
    return { error: error.message };
  }
};

export const exportStandupData = async (req: Request, res: Response) => {
  try {
    // Get filtered standups & statuses
    const standupData = await new Promise((resolve, reject) => {
      const resWrapper = {
        status: (code: number) => ({
          json: (data: any) => resolve(data),
        }),
      };
      getStandupsByFilterOrAll(req, resWrapper as unknown as Response).catch(
        reject
      );
    });

    const { standups, statuses } = standupData as {
      standups: any[];
      statuses: any[];
    };

    console.log("Standups:", standups);
    console.log("Statuses:", statuses);

    // get questions for the standupresponses being exported
    const team = await Team.findOne({
      slackChannelId: statuses[0].slackChannelId,
    });

    console.log("Find team's questions:", statuses[0].slackChannelId);

    if (standups.length === 0) {
      res
        .status(404)
        .json({ message: "No standup data found for the given filters." });
      return;
    }

    const formattedData = standups.map((standup, index) => ({
      date: format(new Date(standup.date), "yyyy-MM-dd"),
      slackChannelId: standup.slackChannelId,
      teamName: standup.teamName,
      questions: team?.standUpConfig.questions.map((item) => item.text),
      members: team?.members,
      responses: JSON.stringify(
        standup.responses.map((item: ResponsesTypes) => item.answer)
      ),
      status: JSON.stringify(statuses[index]) || "unknown",
    }));

    if (req.query.format === "json") {
      res.json({ standups: formattedData });
      return;
    } else {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="standup_data.csv"'
      );

      console.log("Trying csv:", formattedData);

      writeToStream(res, formattedData, { headers: true })
        .on("error", (err) => {
          res.status(500).json({ error: err.message });
        })
        .on("finish", () => {
          res.end();
        });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// // generating team reports
// export const generateTeamReport = async (req: Request, res: Response) => {
//   try {
//     const { slackChannelId } = req.query;

//     if (!slackChannelId) {
//       res.status(400).json({ error: "slackChannelId is required" });
//       return;
//     }

//     // get team details
//     const team = await Team.findOne({ slackChannelId: slackChannelId });
//     if (!team) {
//       res.status(404).json({ error: "Team not found" });
//       return;
//     }

//     // Find the first recorded standup for the team
//     const firstStandup = await StandupResponse.findOne({ slackChannelId }).sort(
//       {
//         date: 1,
//       }
//     );
//     if (!firstStandup) {
//       res.status(404).json({ error: "No standup data found for this team" });
//       return;
//     }

//     // Get all standup responses for the team
//     const standups = await StandupResponse.find({ slackChannelId });

//     // Group standups by date
//     const participationReport: Record<string, any> = {};

//     standups.forEach((standup) => {
//       const date = format(new Date(standup.date), "yyyy-MM-dd");

//       if (!participationReport[date]) {
//         participationReport[date] = {
//           responded: new Set(),
//           missed: new Set(team.members),
//         };
//       }

//       // Add responders
//       participationReport[date].responded.add(standup.userId);
//       participationReport[date].missed.delete(standup.userId);
//     });

//     // Calculate participation rates
//     const reportData = Object.entries(participationReport).map(
//       ([date, data]) => {
//         const totalMembers = team.members.length;
//         const respondedCount = data.responded.size;
//         const participationRate =
//           totalMembers > 0 ? (respondedCount / totalMembers) * 100 : 0;

//         return {
//           date,
//           totalMembers,
//           responded: respondedCount,
//           missed: totalMembers - respondedCount,
//           participationRate: `${participationRate.toFixed(2)}%`,
//         };
//       }
//     );

//     // JSON Response
//     if (req.query.format === "json") {
//       res.json({ team: slackChannelId, report: reportData });
//       return;
//     }

//     // CSV Response
//     res.setHeader("Content-Type", "text/csv");
//     res.setHeader(
//       "Content-Disposition",
//       'attachment; filename="team_report.csv"'
//     );

//     writeToStream(res, reportData, { headers: true })
//       .on("error", (err) => res.status(500).json({ error: err.message }))
//       .on("finish", () => res.end());
//   } catch (error: any) {
//     res.status(500).json({ error: error.message });
//   }
// };
