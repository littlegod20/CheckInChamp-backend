import { slackApp } from "../config/slack";
import { createPollService } from "../controllers/pollController";
import { Block, KnownBlock } from "@slack/types";
import {
  ViewSubmitAction,
  SlackViewMiddlewareArgs,
  SlackActionMiddlewareArgs,
  BlockElementAction,
  AllMiddlewareArgs,
  ButtonAction,
  StaticSelectAction,
} from "@slack/bolt";
import { Poll } from "../models/Poll";
import { Types } from "mongoose";
import { Team } from "../models/Team";

// ✅ Function to Open the Poll Modal
export const openCreatePollModal = async (
  triggerId: string,
  optionCount: number = 2
) => {
  console.log("🔵 Opening Poll Modal - Trigger ID:", triggerId);

  try {
    const optionFields = [];

    for (let i = 1; i <= optionCount; i++) {
      optionFields.push({
        type: "input",
        block_id: `option_${i}`,
        element: { type: "plain_text_input", action_id: "option_value" },
        label: { type: "plain_text", text: `Option ${i}` },
      });
    }

    await slackApp.client.views.open({
      trigger_id: triggerId,
      view: {
        type: "modal",
        callback_id: "create_poll",
        title: { type: "plain_text", text: "Create Poll" },
        blocks: [
          {
            type: "input",
            block_id: "question_block",
            element: { type: "plain_text_input", action_id: "question" },
            label: { type: "plain_text", text: "Poll Question" },
          },
          ...optionFields, // Dynamically add option fields

          // ➕ Add Option Button
          {
            type: "actions",
            block_id: "add_option",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "➕ Add Option" },
                action_id: "add_poll_option",
              },
            ],
          },

          {
            type: "input",
            block_id: "type_block",
            element: {
              type: "static_select",
              action_id: "poll_type",
              options: [
                {
                  text: { type: "plain_text", text: "Select One" },
                  value: "single",
                },
                {
                  text: { type: "plain_text", text: "Select Many" },
                  value: "multiple",
                },
                {
                  text: { type: "plain_text", text: "Rate 1-5" },
                  value: "scale",
                },
              ],
            },
            label: { type: "plain_text", text: "Poll Type" },
          },

          // Anonymous Voting (Optional)
          {
            type: "section",
            block_id: "anonymous_block",
            text: {
              type: "mrkdwn",
              text: "*Would you like to make the poll anonymous?*",
            },
            accessory: {
              type: "checkboxes",
              action_id: "anonymous",
              options: [
                {
                  text: { type: "plain_text", text: "Make anonymous" },
                  value: "yes",
                },
              ],
            },
          },

          // Select Channel to Post Poll
          {
            type: "input",
            block_id: "channel_block",
            element: {
              type: "conversations_select",
              action_id: "select_channel",
              default_to_current_conversation: true,
            },
            label: {
              type: "plain_text",
              text: "Select a Channel to Post the Poll",
            },
          },
        ],
        submit: { type: "plain_text", text: "Create Poll" },
      },
    });

    console.log("✅ Poll modal opened successfully");
  } catch (error) {
    console.error("❌ Error opening poll modal:", error);
  }
};

// ✅ Handle "Create Poll" button click (Opens the modal)
slackApp.action("open_create_poll_modal", async ({ body, ack }) => {
  await ack();
  console.log("🔵 Button clicked: open_create_poll_modal");

  try {
    if (!("trigger_id" in body)) {
      console.error("❌ Missing trigger_id in body:", body);
      return;
    }

    await openCreatePollModal(body.trigger_id);
  } catch (error) {
    console.error("❌ Error opening create poll modal:", error);
  }
});

// ✅ Handle "➕ Add Option" button click (Updates modal with extra option field)
slackApp.action("add_poll_option", async ({ ack, body, client }) => {
  await ack();

  try {
    // Ensure the action is triggered from a modal
    if (!("view" in body) || !body.view) {
      console.error("❌ This action must be triggered from a modal.");
      return;
    }

    const view = body.view;
    const existingBlocks = view.blocks;

    if (!existingBlocks) {
      console.error("❌ No blocks found in the current view");
      return;
    }

    // Count existing options
    const optionBlocks = existingBlocks.filter((block) =>
      block.block_id?.startsWith("option_")
    );
    const newOptionCount = optionBlocks.length + 1;

    console.log(`🔵 Adding another option. New count: ${newOptionCount}`);

    // Create updated blocks array
    const updatedBlocks = [
      // Keep all existing blocks except the "add_option" button
      ...existingBlocks.filter((block) => block.block_id !== "add_option"),
      // Add new option block
      {
        type: "input",
        block_id: `option_${newOptionCount}`,
        element: { type: "plain_text_input", action_id: "option_value" },
        label: { type: "plain_text", text: `Option ${newOptionCount}` },
      },
      // Re-add the "add_option" button at the end
      {
        type: "actions",
        block_id: "add_option",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "➕ Add Option" },
            action_id: "add_poll_option",
          },
        ],
      },
    ];

    // Update the modal with the new option
    await client.views.update({
      view_id: view.id,
      view: {
        type: "modal",
        callback_id: "create_poll",
        title: { type: "plain_text", text: "Create Poll" },
        blocks: updatedBlocks,
        submit: { type: "plain_text", text: "Create Poll" },
      },
    });
  } catch (error) {
    console.error("❌ Error updating poll modal:", error);
  }
});

// ✅ Handle Poll Submission
slackApp.view("create_poll", async ({ ack, body, view }) => {
  await ack();

  try {
    const question =
      view.state.values.question_block.question.value ?? "default_value";
    const options = Object.keys(view.state.values)
      .filter((key) => key.startsWith("option_"))
      .map((key) => view.state.values[key].option_value.value ?? "");

    const type =
      view.state.values.type_block.poll_type?.selected_option?.value ??
      "default_value";
    const anonymous =
      (view.state.values.anonymous_block.anonymous?.selected_options?.length ??
        0) > 0;
    const channelId =
      view.state.values.channel_block.select_channel.selected_conversation;

    const teamName = (await Team.findOne({ slackChannelId: channelId })) as any;

    if (!channelId) {
      console.error("❌ Channel ID is missing");
      return;
    }

    // Create the poll
    const newPoll = await createPollService({
      question,
      options,
      type,
      createdBy: body.user.id,
      anonymous,
      channelId: teamName.name,
    });

    console.log("✅ Poll Created:", newPoll);

    // Post Poll to Selected Channel
    await slackApp.client.chat.postMessage({
      channel: channelId,
      text: `📊 *New Poll Created!*`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${question}*`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `_Click to vote!_`,
          },
        },
        ...(type === "single"
          ? options.map((option, index) => ({
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: option },
                  value: `vote_single_${newPoll._id}_${index}`,
                  action_id: "vote_single",
                },
              ],
            }))
          : []),
        ...(type === "multiple"
          ? options.map((option, index) => ({
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: option },
                  value: `vote_multiple_${newPoll._id}_${index}`,
                  action_id: "vote_multiple",
                },
              ],
            }))
          : []),
        ...(type === "scale"
          ? [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: "*Rate this on a scale of 1-5:*",
                },
                accessory: {
                  type: "static_select",
                  action_id: "vote_scale",
                  placeholder: { type: "plain_text", text: "Select a rating" },
                  options: Array.from({ length: 5 }, (_, i) => ({
                    text: { type: "plain_text", text: `${i + 1}` },
                    value: `vote_scale_${newPoll._id}_${i + 1}`,
                  })),
                },
              } as KnownBlock,
            ]
          : []),
      ],
    });

    console.log("✅ Interactive Poll posted to channel:", channelId);
  } catch (error) {
    console.error("❌ Error creating poll:", error);
  }
});

// 🔹 Handle Single Choice Vote
slackApp.action("vote_single", async ({ ack, body, action }) => {
  await ack();

  try {
    const userId = body.user.id;
    const [pollId, selectedIndex] =
      (action as ButtonAction).value?.split("_").slice(2) || [];

    if (!pollId || !selectedIndex) {
      console.error("❌ Poll ID or selected index is missing.");
      return;
    }

    const poll = await Poll.findOne({ _id: new Types.ObjectId(pollId) });
    if (!poll) {
      console.error("❌ Poll not found.");
      return;
    }

    const existingVote = poll.votes.some((vote) => vote.userId === userId);
    if (existingVote) {
      await slackApp.client.chat.postEphemeral({
        channel: body.channel?.id || "",
        user: userId,
        text: "🚨 You have already voted on this poll! You cannot vote again.",
      });
      return;
    }

    poll.votes.push({ userId, selectedOptions: [selectedIndex] });
    await poll.save();

    await slackApp.client.chat.postEphemeral({
      channel: body.channel?.id || "",
      user: userId,
      text: `✅ Your vote for *${
        poll.options[parseInt(selectedIndex)]
      }* has been recorded.`,
    });
  } catch (error) {
    console.error("❌ Error handling single vote:", error);
  }
});

// 🔹 Handle Multiple Choice Vote
slackApp.action("vote_multiple", async ({ ack, body, action }) => {
  await ack();

  try {
    const userId = body.user.id;
    const [pollId, selectedIndex] =
      (action as ButtonAction).value?.split("_").slice(2) || [];

    if (!pollId || !selectedIndex) {
      console.error("❌ Poll ID or selected index is missing.");
      return;
    }

    const poll = await Poll.findOne({ _id: new Types.ObjectId(pollId) });
    if (!poll) {
      console.error("❌ Poll not found.");
      return;
    }

    const userVote = poll.votes.find((vote) => vote.userId === userId);
    if (userVote) {
      if (userVote.selectedOptions.includes(selectedIndex)) {
        await slackApp.client.chat.postEphemeral({
          channel: body.channel?.id || "",
          user: userId,
          text: "🚨 You have already voted for this option!",
        });
        return;
      }
      userVote.selectedOptions.push(selectedIndex);
    } else {
      poll.votes.push({ userId, selectedOptions: [selectedIndex] });
    }

    await poll.save();

    await slackApp.client.chat.postEphemeral({
      channel: body.channel?.id || "",
      user: userId,
      text: `✅ Your vote for *${
        poll.options[parseInt(selectedIndex)]
      }* has been recorded.`,
    });
  } catch (error) {
    console.error("❌ Error handling multiple vote:", error);
  }
});

// 🔹 Handle Scale Vote
slackApp.action("vote_scale", async ({ ack, body, action }) => {
  await ack();

  try {
    const userId = body.user.id;
    const [pollId, selectedValue] =
      (action as StaticSelectAction).selected_option.value
        ?.split("_")
        .slice(2) || [];

    if (!pollId || !selectedValue) {
      console.error("❌ Poll ID or selected value is missing.");
      return;
    }

    const poll = await Poll.findOne({ _id: new Types.ObjectId(pollId) });
    if (!poll) {
      console.error("❌ Poll not found.");
      return;
    }

    const userVote = poll.votes.find((vote) => vote.userId === userId);
    if (userVote) {
      userVote.scaleValue = parseInt(selectedValue);
    } else {
      poll.votes.push({ userId, scaleValue: parseInt(selectedValue) });
    }

    await poll.save();

    await slackApp.client.chat.postEphemeral({
      channel: body.channel?.id || "",
      user: userId,
      text: `✅ Your vote for *${selectedValue}* has been recorded.`,
    });
  } catch (error) {
    console.error("❌ Error handling scale vote:", error);
  }
});
