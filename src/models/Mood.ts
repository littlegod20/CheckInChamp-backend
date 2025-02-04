import mongoose, { Schema } from "mongoose";

const moodSchema = new Schema({
  userId: String,
  userName: String,
  teamName: String,
  slackChannelId: String,
  mood: String,
  date: Date,
});

export const Mood = mongoose.model("mood", moodSchema);
