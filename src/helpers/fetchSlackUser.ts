import { slackApp } from "../config/slack";

export const fetchSlackUser = async (userId: string) => {
  try {
    const response = await slackApp.client.users.info({ user: userId });
    console.log("response:", response)
    return response.user?.name || "Unknown User";
  } catch (error) {
    console.error(`Error fetching Slack user ${userId}:`, error);
    return "Unknown User";
  }
};