import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITeam extends Document {
  name: string;
  timezone: string;
  slackChannelId: string;
  schedule: string;
  members: Types.ObjectId[];
  description: string;
  is_archived: boolean;
}

const teamSchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  timezone: { type: String },
  schedule: { type: String },
  slackChannelId: { type: String, required: false },
  description: { type: String },
  members: [{type: String}],
  is_archived: { type: Boolean, default: false },
});

export const Team = mongoose.model<ITeam>('Team', teamSchema);