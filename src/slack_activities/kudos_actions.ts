import { slackApp } from "../config/slack";
import { Kudos } from "../models/kudos";
import axios from "axios";
import { Team, TeamDocument } from "../models/Team";
import { Member } from "../models/Member";

// Open Kudos Modal
slackApp.action("open_kudos_modal", async ({ body, ack, client }) => {
  await ack(); // Acknowledge the action

  try {
    await client.views.open({
      trigger_id: (body as { trigger_id: string }).trigger_id,
      view: {
        type: "modal",
        callback_id: "submit_kudos",
        title: {
          type: "plain_text",
          text: "Give Kudos",
        },
        submit: {
          type: "plain_text",
          text: "Send",
        },
        close: {
          type: "plain_text",
          text: "Cancel",
        },
        blocks: [
          {
            type: "input",
            block_id: "select_user",
            element: {
              type: "users_select",
              action_id: "user",
            },
            label: {
              type: "plain_text",
              text: "Select a team member",
            },
          },
          {
            type: "input",
            block_id: "select_team",
            element: {
              type: "channels_select",
              action_id: "team",
            },
            label: {
              type: "plain_text",
              text: "Select a team",
            },
          },
          {
            type: "input",
            block_id: "reason",
            element: {
              type: "plain_text_input",
              action_id: "reason_input",
            },
            label: {
              type: "plain_text",
              text: "Reason for Kudos",
            },
          },
          {
            type: "input",
            block_id: "category",
            element: {
              type: "static_select",
              action_id: "category_select",
              options: [
                {
                  text: {
                    type: "plain_text",
                    text: "🎯 Teamwork",
                  },
                  value: "teamwork",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "💡 Creativity",
                  },
                  value: "creativity",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "🦸 Leadership",
                  },
                  value: "leadership",
                },
              ],
            },
            label: {
              type: "plain_text",
              text: "Select a category",
            },
          },
        ],
      },
    });
  } catch (error) {
    console.error("Error opening Kudos modal:", error);
  }
});

// Handle Kudos Submission
slackApp.view("submit_kudos", async ({ ack, body, view, client }) => {
  await ack();

  const userId = body.user.id;
  const receiverId = view.state.values.select_user.user.selected_user;
  const reason = view.state.values.reason.reason_input.value;
  const category =
    view.state.values.category.category_select?.selected_option?.value;
  const teamId = view.state.values.select_team?.team?.selected_channel;

  const teamName = (await Team.findOne({
    slackChannelId: teamId,
  })) as TeamDocument;

  const giverName = (await Member.findOne({ slackId: userId })) as any;
  const receiverName = (await Member.findOne({ slackId: receiverId })) as any;

  try {
    // Call backend API instead of saving directly
    await axios.post("http://localhost:5000/api/kudos", {
      giverId: giverName.name,
      receiverId: receiverName.name,
      category,
      reason,
      teamName: teamName.name,
    });
    
  } catch (error) {
    console.error("Error sending kudos:", error);
    await client.chat.postMessage({
      channel: userId,
      text: "❌ Something went wrong while sending kudos. Please try again later.",
    });
  }
});
