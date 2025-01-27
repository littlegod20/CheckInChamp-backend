import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMember extends Document {
  name: string;
  slackId: string;
  team: Types.ObjectId;
}

const memberSchema: Schema = new Schema({
  name: { type: String, required: true },
  slackId: { type: String, required: true },
  team: { type: Schema.Types.ObjectId, ref: 'Team' },
});

export const Member = mongoose.model<IMember>('Member', memberSchema);
