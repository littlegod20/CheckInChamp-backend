import { Request, Response } from "express";
import { Team } from "../models/Team";
import { StandupResponse } from "../models/StandUpResponses";

// filter standups by team or date or user or all three by extracting from query
export const getStandupsByFilterOrAll = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { teamId, date, userId } = req.query;

  try {
    const query: any = {};
    if (teamId) query.slackChannelId = teamId;
    if (date) query.date = new Date(date as string).toISOString().split("T")[0];
    if (userId) query.userId = userId;

    // const status = await getStandupStatus(query.slackChannelId, query.date);

    // Fetch standups based on filters
    const standups = await StandupResponse.find(query);

    // Fetch the status for each standup in parallel
    const statusPromises = standups.map((standup) =>
      getStandupStatus(standup.slackChannelId, standup.date)
    );

    const status = await Promise.all(statusPromises);

    res.status(200).json({ standups, status });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// track who responded and who missed the standup
export const getStandupStatus = async (slackChannelId: string, date: Date) => {
  try {
    if (!slackChannelId) {
      return { error: "slackChannelId is required" };
    }
    console.log("Date:", date);
    // Use the provided date or default to today
    const selectedDate = date
      ? new Date(date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    // Find all standup responses for the selected date
    const standups = await StandupResponse.find({
      slackChannelId,
      date: selectedDate,
    });

    console.log("Standups:", standups);

    // Extract user IDs of those who responded
    const respondedUserIds = standups.map((standup) => standup.userId);

    console.log("RespondedUserIds:", respondedUserIds);

    // Get the team and its members
    const team = await Team.findOne({ slackChannelId: slackChannelId }).select(
      "members"
    );
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
        // name: member.name,
        status: "responded",
      }));

    console.log("Responders:", responders);

    const nonResponders = team.members
      .filter((member: any) => !respondedUserIds.includes(member))
      .map((member: any) => ({
        userId: member,
        // name: member.name,
        status: "missed",
      }));

    console.log("NonResponders:", nonResponders);

    const stats = {
      channelId: slackChannelId,
      date: selectedDate,
      participationRate: participationRate.toFixed(2) + "%",
      status: [...responders, ...nonResponders],
    };
    console.log("Stats:", stats.status);
    return stats;
  } catch (error: any) {
    return { error: error.message };
  }
};

// // get team participation rates
// export const getTeamParticipation = async (req: Request, res: Response) => {
//   try {
//     const { teamId } = req.body;
//     if (!teamId) {
//       res.status(400).json({ error: "teamId is required" });
//       return;
//     }

//     // Find all standup responses for the team
//     const standups = await StandupResponse.find({
//       slackChannelId: teamId,
//     });

//     // Extract user IDs of those who responded
//     const respondedUserIds = standups.map((standup) => standup.userId);

//     // Get the team and its members
//     const team = await Team.findOne({ slackChannelId: teamId }).select(
//       "members"
//     );

//     if (!team) {
//       res.status(404).json({ error: "Team not found" });
//       return;
//     }

//     // Calculate participation rate
//     const participationRate =
//       (respondedUserIds.length / team.members.length) * 100;

//     res.status(200).json({
//       teamId,
//       participationRate,
//       totalMembers: team.members.length,
//       totalResponders: respondedUserIds.length,
//     });
//   } catch (error: any) {
//     res.status(500).json({ error: error.message });
//   }
// };


export const getOverallParticipationRate = async (teamId: string) => {
  try {
    if (!teamId) return { error: "teamId is required" };

    // Get all unique dates for the team's standups
    const standupDates = await StandupResponse.distinct("date", {
      slackChannelId: teamId,
    });

    if (standupDates.length === 0) {
      return { error: "No standups found for this team" };
    }

    // Get participation rates for each day
    const dailyRatesPromises = standupDates.map((date) =>
      getStandupStatus(teamId, date)
    );

    const dailyRates = await Promise.all(dailyRatesPromises);

    // Calculate average participation rate
    const validRates = dailyRates
      .filter((entry): entry is { error: any } => 'error' in entry)
      .map((entry) => {
        if ('participationRate' in entry && typeof entry.participationRate === 'string') {
          return parseFloat(entry.participationRate);
        }
        return 0;
      });

    const overallRate =
      validRates.length > 0
        ? (
            validRates.reduce((sum, rate) => sum + rate, 0) / validRates.length
          ).toFixed(2) + "%"
        : "0%";

    return {
      teamId,
      overallParticipationRate: overallRate,
      dailyParticipationRates: dailyRates,
    };
  } catch (error: any) {
    return { error: error.message };
  }
};
