import mongoose, { Schema, Document, Types } from "mongoose";

export interface TeamDocument extends Document {
  name: string;
  members: string[];
  slackChannelId?: string;
  standUpConfig: {
    questions: Array<{
      id: string;
      options: string[];
      require: boolean;
      text: string;
      type: string;
    }>;
    reminderTimes: string[];
    standUpDays: string[];
    standUpTimes: string[];
  };
  timezone: string;
  is_archived: boolean;
}

const teamSchema: Schema<TeamDocument> = new Schema({
  name: { type: String, required: true, unique: true },
  members: [String],
  slackChannelId: { type: String, required: false },
  standUpConfig: {
    questions: [
      {
        id: { type: String },
        options: [{ type: String }],
        require: { type: Boolean },
        text: { type: String, required: true },
        type: { type: String, required: true },
      },
    ],
    reminderTimes: [{ type: String, required: true }],
    standUpDays: [{ type: String, required: true }],
    standUpTimes: [{ type: String, required: true }],
  },
  timezone: { type: String, required: true },
  // is_archived: { type: String, default: false },
  // createdAt: { type: Date, required: true },
});

export const Team = mongoose.model<TeamDocument>("Team", teamSchema);
