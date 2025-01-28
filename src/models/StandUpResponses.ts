import mongoose from "mongoose";
const { Schema, Document, Types } = mongoose;

const standupResponseSchema = new Schema({
  messageTs: { type: String, required: true },
  slackChannelId: { type: String, required: true },
  userId: { type: String, required: true },
  date: { type: Date, required: true },
  responses: [
    {
      questionId: { type: String, required: true },
      answer: { type: String, required: true },
    },
  ],
});

export const StandupResponse = mongoose.model(
  "StandupResponse",
  standupResponseSchema
);
