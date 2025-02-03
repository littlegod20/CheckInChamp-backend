import { WebClient } from "@slack/web-api";
import { Team } from "../../models/Team";
import { StandupResponse } from "../../models/StandUpResponses";

// Initialize Slack client
const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

export const handleModalSubmission = async (payload: any) => {
  if (
    payload.type === "view_submission" &&
    payload.view.callback_id === "standup_submission"
  ) {
    const { standupId, slackChannelId } = JSON.parse(
      payload.view.private_metadata
    );
    const userId = payload.user.id;

    console.log("standupId:", standupId);
    console.log("slackChannelId:", slackChannelId);
    console.log("userId:", userId);

    const teamDoc = await Team.findOne({ slackChannelId: slackChannelId });

    if (!teamDoc) {
      throw new Error("Team not found");
    }

    // get questions from team document
    const teamQuestions = teamDoc?.standUpConfig.questions || [];

    // Extract answers dynamically based on input type
    const answers = Object.entries(payload.view.state.values).map(
      ([blockId, blockData]) => {
        const actionId = Object.keys(blockData as object)[0];
        const inputData = (blockData as any)[actionId];

        // Find the corresponding question from team's questions
        const questionId = blockId.replace("question_", "");
        console.log("questionId:", questionId);
        const questionDetails = teamQuestions.find((q) => q.id === questionId);

        // console.log("QuestionDets:", questionDetails);
        if (!questionDetails) {
          console.error(`No question found for block ID: ${blockId}`);
          return null;
        }

        // Comprehensive input type handling
        let answer;
        switch (inputData.type) {
          case "plain_text_input":
            answer = inputData.value;
            break;
          case "static_select":
            answer = inputData.selected_option?.value;
            break;
          case "radio_buttons":
            answer = inputData.selected_option?.value;
            break;
          case "checkboxes":
            answer = inputData.selected_options?.map((opt: any) => opt.value);
            break;
          case "multi_static_select":
            answer = inputData.selected_options?.map((opt: any) => opt.value);
            break;
          default:
            answer = null;
        }

        return {
          questionId: questionDetails.id, // Use actual question ID from db
          questionType: questionDetails.type,
          answer: answer,
        };
      }
    );

    const today = new Date().toISOString().split("T")[0];
    const responseTime = new Date().toISOString();

    try {
      const standupDoc = await StandupResponse.findOne({
        standupId: standupId,
      });

      console.log("StandupDoc:", standupDoc);

      if (standupDoc) {
        // Add response to the database

        await StandupResponse.updateOne(
          { standupId: standupId }, // Query
          {
            $push: {
              responses: {
                userId: userId,
                answers: answers,
                responseTime: responseTime,
              },
            },
          }
        );

        // // Store the `ts` in the database for later use
        // await StandupResponse.updateOne(
        //   { slackChannelId: slackChannelId }, // Query
        //   {
        //     $set: {
        //       userId,
        //       responses: answers,
        //       date: today,
        //       responseTime,
        //     },
        //   },
        //   { upsert: true } // create if not found
        // );

        // Get the `ts` of the initial standup message
        const standupMessageTs = standupDoc?.messageTs;

        if (standupMessageTs) {
          // Post response in a thread
          await slackClient.chat.postMessage({
            channel: slackChannelId,
            text: `📋 *Response from <@${userId}>:*\n${answers
              .map(
                (answer, index) =>
                  `Q${index + 1}: ${answer?.answer || "No response"}`
              )
              .join("\n")}`,
            thread_ts: standupMessageTs,
          });
        }

        await slackClient.chat.postMessage({
          channel: userId,
          text: `Thank you for submitting your standup responses for <#${teamDoc.slackChannelId}|${teamDoc.name}>`,
        });
      } else {
        console.error("Standup document not found.");
      }
    } catch (error) {
      console.error("Error handling modal submission:", error);
    }
  } else {
    console.log("No submission action has taken place.");
  }
};
