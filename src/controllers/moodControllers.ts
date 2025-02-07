import { Request, Response } from "express";
import { MoodResponse } from "../models/MoodResponse";
import { MoodTime } from "../models/MoodTime";
import { WebClient } from "@slack/web-api";
import { Member } from "../models/Member";
import { Team, TeamDocument } from "../models/Team";

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

export const createMoodResponse = async (req: Request, res: Response) => {
  try {
    const { userId, userName, teamName, slackChannelId, mood, date } = req.body;

    if (
      !userId ||
      !userName ||
      !teamName ||
      !slackChannelId ||
      !mood ||
      !date
    ) {
      throw new Error(`Ensure all fields are valid and not empty`);
    }

    const channelName = `team-${teamName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")}`; // Format channel name

    const newMood = {
      userId,
      userName,
      teamName: channelName,
      slackChannelId,
      mood,
      date,
    };

    const addMood = await MoodResponse.create(newMood);

    res
      .status(200)
      .json({ message: "Mood created successfully", data: addMood });
  } catch (error) {
    console.error("Error creating mood for user:", error);
    res.status(500).json({ message: "Error creating mood" });
  }
};

export const getMoodResponses = async (req: Request, res: Response) => {
  try {
    // adding pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    console.log("hitting the backend...");

    // Add sorting
    const sort: string = (req.query.sort as string) || "-date";

    // adding basic filters
    const filter = { ...req.query };
    delete filter.page;
    delete filter.limit;
    delete filter.sort;

    const moods = await MoodResponse.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await MoodResponse.countDocuments(filter);

    res.status(200).json({
      data: moods,
      pagination: {
        page,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error getting moods", error);
    res.status(500).json({ message: "Error fetching moods" });
  }
};

export const createMoodTime = async (req: Request, res: Response) => {
  try {
    const { teamName, slackChannelId, moodTime } = req.body;

    if (!teamName || !slackChannelId || !moodTime) {
      res.status(400).json({ message: "All fields are required" });
      return;
    }

    // Check if mood time already exists for this team
    const existingMood = await MoodTime.findOne({ slackChannelId });
    if (existingMood) {
      res.status(400).json({ message: "Mood time already set for this team" });
      return;
    }

    // Create new mood time entry
    const newMood = await MoodTime.create({
      teamName,
      slackChannelId,
      moodTime,
    });

    res
      .status(201)
      .json({ message: "Mood time saved successfully", data: newMood });
  } catch (error) {
    console.error("Error saving mood time:", error);
    res.status(500).json({ message: "Error saving mood time" });
  }
};

// controllers/moodController.ts
export const updateMoodTime = async (req: Request, res: Response) => {
  try {
    const { slackChannelId, moodTime } = req.body;

    if (!slackChannelId || !moodTime) {
      res.status(400).json({ message: "All fields are required" });
      return;
    }

    const updatedMood = await MoodTime.findOneAndUpdate(
      { slackChannelId },
      { moodTime },
      { new: true }
    );

    if (!updatedMood) {
      res.status(404).json({ message: "Mood time not found" });
      return;
    }

    res
      .status(200)
      .json({ message: "Mood time updated successfully", data: updatedMood });
  } catch (error) {
    console.error("Error updating mood time:", error);
    res.status(500).json({ message: "Error updating mood time" });
  }
};

// export const handleMoodInteraction = async (req: Request, res: Response) => {
//   const payload = JSON.parse(req.body.payload);

//   if (await handleMoodSelection(payload)) {
//     res.status(200).send();
//     console.log("Sending...");
//   } else {
//     res.status(500).send("Error processing mood selection");
//     console.log("errror sending...");
//   }
// };

export const deleteMoodTime = async (req: Request, res: Response) => {
  try {
    // res.send("Delete");
    const { teamName, slackChannelId } = req.body;

    const deleteMoodTime = await MoodTime.findOneAndDelete({
      teamName,
      slackChannelId,
    });

    if (!deleteMoodTime) {
      res.status(404).json({ msg: "No mood time avaible for deletion." });
      return;
    }

    res
      .status(200)
      .json({ success: true, msg: "Mood Time deleted successfully" });
  } catch (err) {
    console.error("Error deleting mood time");
  }
};

export const getMoodTime = async (req: Request, res: Response) => {
  // const {slackChannelId} = req
  try {
    const times = await MoodTime.find();
    if (!times) {
      res.status(404).json({ msg: "No mood checkin times exist" });
      return;
    }
    res.status(200).json({ message: "Success", data: times });
  } catch (error) {
    console.error("Error fetching mood times", error);
  }
};

// Add this handler to process the mood selection
export const handleMoodSelection = async (payload: any) => {
  if (
    payload.actions &&
    payload.actions[0].action_id.startsWith("mood_selection_")
  ) {
    console.log("hitting...");

    const selectedMood = payload.actions[0].value;
    const userId = payload.user.id;
    const channelId = payload.channel.id;

    const userName = await Member.findOne({ slackId: userId });
    const teamName = (await Team.findOne({
      slackChannelId: channelId,
    })) as unknown as TeamDocument;

    console.log("selected Mood:", selectedMood);

    try {
      const today = new Date().toISOString().split("T")[0];
      const responseDoc = await MoodResponse.find({
        slackChannelId: channelId,
      });

      if (responseDoc) {
        console.log("responseDoc:", responseDoc);
        const hasRespondedToday = responseDoc.some(
          (response) =>
            response.userId === userId &&
            response.date?.toISOString().split("T")[0] === today
        );

        if (hasRespondedToday) {
          await slackClient.views.open({
            trigger_id: payload.trigger_id,
            view: {
              type: "modal",
              callback_id: "mood_already_submitted",
              title: {
                type: "plain_text",
                text: "Already Submitted",
              },
              close: {
                type: "plain_text",
                text: "Close",
              },
              blocks: [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `You have already submitted your mood response today!`,
                  },
                },
              ],
            },
          });
          return;
        }
      }

      // Store the mood response in your database

      const moodResponse = await MoodResponse.create({
        userId,
        slackChannelId: channelId,
        teamName: teamName.name,
        userName: userName?.name,
        mood: selectedMood,
        date: new Date(),
      });

      // Send confirmation
      await slackClient.chat.postMessage({
        channel: userId,
        text: `Thanks for sharing your mood! (${selectedMood})`,
      });

      return true;
    } catch (error) {
      console.error("Error handling mood selection:", error);
      return false;
    }
  }
};
