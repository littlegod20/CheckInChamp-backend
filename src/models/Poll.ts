import mongoose from "mongoose";

const PollSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [{ type: String, required: true }], // Options for the poll
  type: { type: String, enum: ["single", "multiple", "scale"], required: true }, // Poll type
  createdBy: { type: String, required: true }, // Slack User ID of the creator
  votes: [
    {
      userId: { type: String, required: true },
      selectedOptions: [String], // Stores selected options (for single/multiple choice)
      scaleValue: { type: Number }, // For scale rating (1-5)
      timestamp: { type: Date, default: Date.now },
    },
  ],
  anonymous: { type: Boolean, default: false },
  channelId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const Poll = mongoose.model("Poll", PollSchema);