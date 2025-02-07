import mongoose from "mongoose";
const { Schema } = mongoose;

const standupResponseSchema = new Schema({
  teamName: String,
  messageTs: { type: String, required: true },
  slackChannelId: { type: String, required: true },
  // userId: { type: String, required: true },
  date: { type: Date, required: true },
  responses: [
    {
      userId: { type: String, required: true }, // User ID of the respondent
      answers: [
        {
          questionId: { type: String, required: true }, // Question ID
          questionType: { type: String, required: true }, // Question type
          answer: { type: Schema.Types.Mixed }, // Answer (can be string, array, etc.)
        },
      ],
      responseTime: { type: String, required: true }, // Time of response
    },
  ],
  standupId: String,
  // responseTime: Date,
});

export const StandupResponse = mongoose.model(
  "StandupResponse",
  standupResponseSchema
);
