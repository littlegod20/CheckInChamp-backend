import { slackApp } from "../config/slack";

export const home_pub = () => {
  slackApp.event("app_home_opened", async ({ event, client }) => {
    try {
      await client.views.publish({
        user_id: event.user,
        view: {
          type: "home",
          callback_id: "home_view",
          blocks: [
            {
              type: "section",
              text: { type: "mrkdwn", text: "Welcome to *Check In Champ*! 🎉" },
            },
            { type: "divider" },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "Manage Teams" },
                  url: "http://localhost:5173/",
                },
              ],
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "Give Kudos" },
                  action_id: "open_kudos_modal",
                },
                {
                  type: "button",
                  text: { type: "plain_text", text: "📊 Create Poll" },
                  action_id: "open_create_poll_modal", // Button for opening poll modal
                  style: "primary",
                },
              ],
            },
          ],
        },
      });
    } catch (error) {
      console.error("Error publishing App Home:", error);
    }
  });
};
