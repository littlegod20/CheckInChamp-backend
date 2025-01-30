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
  const { teamId, date, userId } = req.query;
  try {
    const query: any = {};
    if (teamId) query.slackChannelId = teamId;
    if (date) query.date = new Date(date as string).toISOString().split("T")[0];
    if (userId) query.userId = userId;

    // Fetch standups based on filters
    const standups = await StandupResponse.find(query);

    // console.log("Standups:", standups)

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
      channelId: slackChannelId,
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

    console.log("Standup Data:", standupData);

    const { standups, statuses } = standupData as {
      standups: any[];
      statuses: any[];
    };

    console.log("Standups:", standups);
    console.log("Statuses:", statuses);

    if (standups.length === 0) {
      res
        .status(404)
        .json({ message: "No standup data found for the given filters." });
      return;
    }

    const formattedData = standups.map((standup, index) => ({
      date: format(new Date(standup.date), "yyyy-MM-dd"),
      teamId: standup.slackChannelId,
      // userId: standup.userId,
      responses: standup.responses,
      status: statuses[index] || "unknown",
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

      // const csvStream = csvFormat.createWriteStream({ headers: true });
      // const dataStream = csvFormat.write(formattedData, { headers: true });

      // dataStream
      //   .pipe(csvStream)
      //   .pipe(res)
      //   .on("error", (err) => {
      //     res.status(500).json({ error: err.message });
      //   });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
