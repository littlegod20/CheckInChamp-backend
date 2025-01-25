import { slackApp } from "../config/slack";

export const home_pub = () =>{
    // Add event listener for app_home_opened events
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
                    text: {
                      type: "mrkdwn",
                      text: "Welcome to *FlowSync*! 🎉\n\nFlowSync is here to transform how you work. Customize and configure your bot with ease using our web-based interface. Create personalized workflows, automate tasks, and unlock your team's productivity. Let's sync and flow together!"
                    }
                  },
                {
                  type: "divider"
                },
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: "Here are some quick actions:"
                  }
                },
                {
                  type: "actions",
                  elements: [
                    {
                      type: "button",
                      text: {
                        type: "plain_text",
                        text: "Read about FlowSync"
                      },
                      "url": "http://localhost:5173/"
                    },
                    {
                      type: "button",
                      text: {
                        type: "plain_text",
                        text: "Get Started"
                      },
                      "url": "http://localhost:5173/"
                    }
                  ]
                }
              ]
            }
          });
        } catch (error) {
          console.error("Error publishing App Home:", error);
        }
      });
      
}
