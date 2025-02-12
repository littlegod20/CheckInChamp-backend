import mongoose, { Schema, Document, Types } from 'mongoose';
import { IMember } from '../types/MemberTypes';



const memberSchema: Schema = new Schema({
  name: { type: String, required: true },
  slackId: { type: String, required: true },
  team: { type: Schema.Types.ObjectId, ref: 'Team' },
});

export const Member = mongoose.model<IMember>('Member', memberSchema);
