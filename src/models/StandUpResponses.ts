import mongoose from "mongoose";
const { Schema } = mongoose;

const standupResponseSchema = new Schema({
  teamName: String,
  messageTs: { type: String, required: true },
  slackChannelId: { type: String, required: true },
  userId: { type: String, required: true },
  date: { type: Date, required: true },
  responses: [
    {
      questionId: { type: String, required: true },
      questionType: String,
      answer: String,
    },
  ],
  standupId: String,
  responseTime: Date,
});

export const StandupResponse = mongoose.model(
  "StandupResponse",
  standupResponseSchema
);
