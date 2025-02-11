import { Types } from "mongoose";

export interface IMember extends Document {
  name: string;
  slackId: string;
  team: Types.ObjectId;
}
