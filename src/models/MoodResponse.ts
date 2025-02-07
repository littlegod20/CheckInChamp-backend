import mongoose, { Schema } from "mongoose";

const moodResponseSchema = new Schema({
  userId: String,
  userName: String,
  teamName: String,
  slackChannelId: String,
  mood: String,
  date: Date,
});

export const MoodResponse = mongoose.model("moodResponse", moodResponseSchema);
