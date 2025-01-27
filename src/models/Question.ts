import mongoose, { Schema, Document, Model } from 'mongoose';

// Define the Question schema
const questionSchema: Schema = new Schema({
  team: { type: String, required: true }, // The team ID to which the question belongs to
  text: { type: String, required: true }, // The question text
  answer: { type: String, required: true }, // The answer text
});

export interface IQuestion extends Document {
  team: string;
  text: string;
  answer: string; // Updated to match the expected "text" type
}

export const Question: Model<IQuestion> = mongoose.model<IQuestion>('Question', questionSchema);
