import { writeToStream } from "@fast-csv/format";
import { format } from "date-fns";
import { Request, Response } from "express";
import { Team } from "../models/Team";
import { StandupResponse } from "../models/StandUpResponses";

// Filter standups by team or date or user or all three by extracting from query
export const getStandupsByFilterOrAll = async (
  req: Request,
  res: Response
): Promise<void> => {
  const {
    slackChannelId,
    date,
    userId,
    page = 1,
    limit = 10,
    sort = "-date",
  } = req.query;
  try {
    const query: any = {};
    if (slackChannelId) query.slackChannelId = slackChannelId;
    if (date) query.date = new Date(date as string).toISOString().split("T")[0];
    if (userId) query.userId = userId;

    // converting page and limit to numbers
    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);

    // calculate the number of documents to skip
    const skip = (pageNumber - 1) * limitNumber;

    // fetch total count of documents (for pagination metadata)
    const total = await StandupResponse.countDocuments(query);

    // Fetch standups based on filters
    const standups = await StandupResponse.find(query)
      .sort(sort as string)
      .skip(skip)
      .limit(limitNumber);

    // Fetch the status for each standup in parallel
    const statusPromises = standups.map((standup) =>
      getStandupStatus(standup.slackChannelId, standup.date)
    );
    const statuses = await Promise.all(statusPromises);

    // Calculate total pages
    const totalPages = Math.ceil(total / limitNumber);

    res.status(200).json({
      standups,
      statuses,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages,
      },
    });
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

    const selectedDate = date ? date : new Date().toISOString();

    // Find all standup responses for the selected date
    const standups = await StandupResponse.find({
      slackChannelId,
      date: selectedDate,
    });

    console.log("before respondedUserIds:", standups);
    // Extract user IDs of those who responded
    const respondedUserIds = standups
      .flatMap((standup) =>
        standup.responses.map((response) => response.userId)
      ) // Extract userId from responses
      .filter((userId, index, self) => self.indexOf(userId) === index); // Remove duplicates
    // const respondedUserIds = standups.map((standup) => standup.userId);

    // Get the team and its members
    const team = await Team.findOne({ slackChannelId: slackChannelId })
      .select("members")
      .select("name")
      .select("standUpConfig.questions");

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

    // Include questions and standup _id in the response
    const stats = {
      slackChannelId: slackChannelId,
      teamName: team.name,
      date: selectedDate,
      participationRate: participationRate.toFixed(2) + "%",
      status: [...responders, ...nonResponders],
      questions: team.standUpConfig.questions, // Include questions from team's standUpConfig
      _id: standups.map((standup) => standup._id), // Include _id of standup responses
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

    const formattedData = standups.flatMap((standup, index) => {
      const status = statuses[index];
      const questions = team?.standUpConfig.questions || [];
      const members = team?.members || [];

      return standup.responses.map((response: any) => {
        // Create base object
        const base = {
          date: format(new Date(standup.date), "yyyy-MM-dd"),
          slackChannelId: standup.slackChannelId,
          teamName: standup.teamName,
          participationRate: status.participationRate,
        };

        // Add questions and answers
        const qa = questions.reduce((acc: any, question: any, idx: number) => {
          acc[`Q${idx + 1}`] = response.answers[idx]?.answer || "No response";
          return acc;
        }, {});

        // Add user info
        const user = {
          userId: response.userId,
          responseTime: response.responseTime,
          status:
            status.status.find((s: any) => s.userId === response.userId)
              ?.status || "unknown",
        };

        return { ...base, ...user, ...qa };
      });
    });

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
