import mongoose from "mongoose";

const KudosSchema = new mongoose.Schema({
  giverId: { type: String, required: true },
  receiverId: { type: String, required: true },
  category: { type: String, required: true },
  reason: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

export const Kudos = mongoose.model("Kudos", KudosSchema);
