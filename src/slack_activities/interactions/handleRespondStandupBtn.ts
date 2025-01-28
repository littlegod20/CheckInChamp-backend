import { WebClient } from "@slack/web-api";
import { Team } from "../../models/Team";
import { StandupResponse } from "../../models/StandUpResponses";

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN as string);

export const handleButtonClick = async (payload: any) => {
  const slackChannelId = payload.channel.id;
  const userId = payload.user.id;

  try {
    // parsing standupId from the button's value
    const standupId = payload.actions[0].value.split("standup_")[1];

    console.log("payloadActionsValue:", payload.actions[0].value);
    console.log("standupId:", standupId);

    // Fetch standup questions for the team from the database
    const teamDoc = (await Team.findOne({
      slackChannelId: slackChannelId,
    })) as unknown as TeamDocumentTypes;

    if (!teamDoc) {
      console.error(`No data found for teamId: ${slackChannelId}`);
      return;
    }

    // const teamData = teamDoc;
    console.log("TeamData:", teamDoc);
    const standupQuestions = teamDoc?.standUpConfig.questions || [];

    console.log("standupQuestions:", standupQuestions);

    if (standupQuestions.length === 0) {
      console.log(
        `No standup questions configured for slackChannelId: ${slackChannelId}`
      );
      return;
    }

    // Find the matching standup configuration
    // const standupConfig = standupQuestions

    if (!standupQuestions) {
      console.error(`Standup configuration not found for ID: ${standupId}`);
      return;
    }

    // Check if the user has already submitted for today
    const today = new Date().toISOString().split("T")[0];
    const standupDoc = await StandupResponse.findOne({ standupId: standupId });

    if (standupDoc) {
      const hasRespondedToday = standupDoc.userId === userId && new Date(standupDoc.date).toISOString().split("T")[0] === today;

      if (hasRespondedToday) {
        // Open a modal indicating the user has already submitted
        await slackClient.views.open({
          trigger_id: payload.trigger_id,
          view: {
            type: "modal",
            callback_id: "standup_already_submitted",
            title: {
              type: "plain_text",
              text: "Already Submitted",
            },
            close: {
              type: "plain_text",
              text: "Close",
            },
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `You have already submitted your standup responses for <#${slackChannelId}|${teamDoc.name}> today!`,
                },
              },
            ],
          },
        });
        return;
      }
    }

    // Dynamically generate modal blocks based on fetched questions
    const modalBlocks = standupQuestions.map((item, index: number) => {
      const questionId = item.id || index


      let element;

      console.log("question id:", item.id);

      // Customize the element based on the type
      switch (item.type) {
        case "plain_text_input":
          element = {
            type: "plain_text_input",
            action_id: `answer_${questionId}`,
            multiline: true,
          };
          break;

        case "static_select":
          element = {
            type: "static_select",
            action_id: `answer_${questionId}`,
            placeholder: {
              type: "plain_text",
              text: "Choose an option",
            },
            options: item.options?.map((option: string) => ({
              text: { type: "plain_text", text: option },
              value: option,
            })),
          };
          break;

        case "radio":
          element = {
            type: "radio_buttons",
            action_id: `answer_${questionId}`,
            options: item.options?.map((option: string) => ({
              text: { type: "plain_text", text: option },
              value: option,
            })),
          };
          break;

        case "checkbox":
          element = {
            type: "checkboxes",
            action_id: `answer_${questionId}`,
            options: item.options?.map((option: string) => ({
              text: { type: "plain_text", text: option },
              value: option,
            })),
          };
          break;

        default:
          element = {
            type: "plain_text_input",
            action_id: `answer_${questionId}`,
          };
          break;
      }

      return {
        type: "input",
        block_id: `question_${questionId}`,
        element: element,
        label: {
          type: "plain_text",
          text: item.text,
        },
        optional: !item.required,
      };
    });
    // Open the modal with dynamically generated blocks
    await slackClient.views.open({
      trigger_id: payload.trigger_id,
      view: {
        type: "modal",
        callback_id: "standup_submission",
        private_metadata: JSON.stringify({
          standupId,
          slackChannelId: teamDoc.slackChannelId,
        }),
        title: {
          type: "plain_text",
          text: "Submit Your Standup",
        },
        blocks: modalBlocks,
        submit: {
          type: "plain_text",
          text: "Submit",
        },
      },
    });
  } catch (error) {
    console.error("Error handling button click:", error);
  }
};
