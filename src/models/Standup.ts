import mongoose, { Schema, Document, Types } from 'mongoose';
//import { Question } from './Question';

export interface IStandup extends Document {
  team: Types.ObjectId;
  member: Types.ObjectId;
  date: Date;
  update: { question: Types.ObjectId; answer: string }[];
}

const standupSchema = new mongoose.Schema({
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  date: { type: String, required: true },
  update: [
    {
      question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' }, // <-- Check this
      answer: { type: String, required: true },
    },
  ],
});


export const Standup = mongoose.model<IStandup>('Standup', standupSchema);


