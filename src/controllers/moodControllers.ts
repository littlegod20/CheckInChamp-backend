import { Request, Response } from "express";
import { Mood } from "../models/Mood";


export const createMood = async (req: Request, res: Response) => {
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
    const newMood = {
      userId,
      userName,
      teamName,
      slackChannelId,
      mood,
      date,
    };

    const addMood = await Mood.create(newMood);

    res
      .status(200)
      .json({ message: "Mood created successfully", data: addMood });
  } catch (error) {
    console.error("Error creating mood for user:", error);
    res.status(500).json({ message: "Error creating mood" });
  }
}

export const getMoods = async (req: Request, res: Response) => {
  try {
    // adding pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    console.log("hitting the backend...")

    // Add sorting
    const sort: string = (req.query.sort as string) || "-date";

    // adding basic filters
    const filter = { ...req.query };
    delete filter.page;
    delete filter.limit;
    delete filter.sort;

    const moods = await Mood.find(filter).sort(sort).skip(skip).limit(limit);

    const total = await Mood.countDocuments(filter);

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