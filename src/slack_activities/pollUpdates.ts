import { KnownBlock } from "@slack/web-api";
import { Poll } from "../models/Poll"; // Adjust the path based on your structure
import {  web } from "../config/slack";

// Define a TypeScript interface for the Poll type
interface PollDocument {
    _id: string;
    question: string;
    options: string[];
    type: "single" | "multiple" | "scale";
    createdBy: string;
    votes: {
        userId: string;
        selectedOptions: number[];
        scaleValue?: number;
        timestamp: Date;
    }[];
    anonymous: boolean;
    channelId: string;
    createdAt: Date;
}

// Function to update the poll results
export const updatePollResults = async (channelId: string, messageTs: string, poll: typeof Poll) => {
    const votesByOption: Record<number, string[]> = {};
    const scaleVotes: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }; 

    for (const vote of poll.votes) {
        if (poll.type === "scale" && vote.scaleValue !== undefined) {
            scaleVotes[vote.scaleValue] += 1; 
        } else {
            for (const optionIndex of vote.selectedOptions) {
                if (!votesByOption[optionIndex]) {
                    votesByOption[optionIndex] = [];
                }
                votesByOption[optionIndex].push(`<@${vote.userId}>`); 
            }
        }
    }

    const updatedBlocks: KnownBlock[] = [
        {
            type: "section",
            text: { type: "mrkdwn", text: `*${poll.question}*` },
        },
    ];

    if (poll.type === "scale") {
        updatedBlocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: Object.entries(scaleVotes)
                    .map(([value, count]) => `*${value}*: ${count} votes`)
                    .join("\n"),
            },
        });
    } else {
        poll.options.forEach((option, index) => {
            const voters = votesByOption[index] || [];
            updatedBlocks.push({
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*${option}* (${voters.length} votes) ${voters.length > 0 ? `- ${voters.join(", ")}` : ""}`,
                },
                accessory: {
                    type: "button",
                    text: { type: "plain_text", text: "Vote" },
                    value: `vote_${poll.type}_${poll._id}_${index}`,
                    action_id: `vote_${poll.type}`,
                },
            });
        });
    }

    await slackApp.client.chat.update({
        channel: channelId,
        ts: messageTs,
        blocks: updatedBlocks,
        text: `Poll Updated: ${poll.question}`,
    });
};