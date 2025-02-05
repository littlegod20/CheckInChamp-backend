import { Schema, model } from "mongoose";

const moodTimeSchema = new Schema({
  teamName: { type: String, required: true },
  slackChannelId: { type: String, required: true },
  moodTime: { type: String, required: true }, // e.g., "14:00" (24-hour format)
  createdAt: { type: Date, default: Date.now },
});

export const MoodTime = model("moodTime", moodTimeSchema);
