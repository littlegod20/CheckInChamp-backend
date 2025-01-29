import mongoose, { Schema, Document, Types } from "mongoose";

// interface IStandUpQuestion {
//   _id: string;
//   options?: string[] | number[];
//   require: boolean;
//   text: string;
//   type: string;
// }

// export interface ITeam extends Document {
//   name: string;
//   members: string[];
//   slackChannelId: string;
//   standUpConfig: {
//     questions: IStandUpQuestion[];
//     reminderTimes: string[];
//     standUpDays: string[];
//     standUpTimes: string[];
//   };
//   timezone: string;
//   is_archived: boolean;
// }

const teamSchema: Schema = new Schema({
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
  is_archived: { type: Boolean, default: false },
});

export const Team = mongoose.model<TeamDocumentTypes>("Team", teamSchema);
