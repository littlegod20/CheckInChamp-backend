import { MongoClient } from "mongodb";
import schedule from "node-schedule";
import { WebClient } from "@slack/web-api";
import { DateTime } from "luxon";
import { MoodTime } from "../models/MoodTime";
import { MoodResponse } from "../models/MoodResponse";
import { MoodTimeTypes } from "../types/MoodTypes";

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

// Store scheduled jobs in a map for easy access and cancellation
const scheduledJobs = new Map<string, schedule.Job>();

// Mood options configuration
const MOOD_OPTIONS = [
  {
    label: ":smile: Happy",
    value: "happy",
    description: "Feeling positive and productive",
  },
  {
    label: ":neutral_face: Neutral",
    value: "neutral",
    description: "Doing okay, nothing special",
  },
  {
    label: ":disappointed: Sad",
    value: "sad",
    description: "Feeling down or unmotivated",
  },
];

// Convert 12-hour format to 24-hour format
export const convert12hrTo24hr = (
  time12hr: string,
  timezone: string
): string => {
  const time24hr = DateTime.fromFormat(time12hr, "h:mm a", { zone: timezone });

  if (!time24hr.isValid) {
    throw new Error(`Invalid time format: ${time12hr}`);
  }

  return time24hr.toFormat("HH:mm");
};

// Function to schedule a mood check-in job
export const scheduleMoodCheckIn = (mood: MoodTimeTypes) => {
  // Convert the 12-hour format time to 24-hour format
  const time24hr = convert12hrTo24hr(mood.moodTime, "UTC"); // Use appropriate timezone

  // Split the 24-hour format time into hours and minutes
  const [hour, minute] = time24hr.split(":").map(Number);

  // Schedule job for working days (Monday to Friday)
  const rule = new schedule.RecurrenceRule();
  rule.dayOfWeek = [1, 2, 3, 4, 5]; // Monday to Friday
  rule.hour = hour;
  rule.minute = minute;
  rule.tz = "UTC"; // Adjust timezone as needed

  const job = schedule.scheduleJob(rule, async () => {
    try {
      // Create message blocks with emoji buttons
      const blocks = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*How are you feeling today?* :bar_chart:\nPlease select your current mood:`,
          },
        },
        {
          type: "actions",
          elements: MOOD_OPTIONS.map((option) => ({
            type: "button",
            text: {
              type: "plain_text",
              text: `${option.label}  ${option.description}`,
              emoji: true,
            },
            value: option.value,
            action_id: `mood_selection_${option.value}`,
          })),
        },
      ];

      await slackClient.chat.postMessage({
        channel: mood.slackChannelId,
        text: "Daily Mood Check-In", // Fallback text
        blocks,
      });

      console.log(`Mood check-in sent to ${mood.teamName}`);
    } catch (error) {
      console.error(`Error sending mood check-in to ${mood.teamName}:`, error);
    }
  });

  // Store the job in the map
  scheduledJobs.set(mood._id.toString(), job);
};

// Function to listen for mood time updates
export const listenForMoodTimeUpdates = async () => {
  try {
    // Add pipeline to include full document on updates
    const changeStream = MoodTime.watch([], {
      fullDocument: "updateLookup", // Include full document for update operations
    });

    console.log("Listening for mood time updates...");

    changeStream.on("change", async (change) => {
      console.log("Change detected:", change.operationType);

      // Handle document updates
      if (
        change.operationType === "update" ||
        change.operationType === "replace"
      ) {
        let updatedMood = change.fullDocument as MoodTimeTypes;

        if (!updatedMood) {
          console.log(
            "No full document available for update, fetching manually..."
          );
          const doc = await MoodTime.findById(change.documentKey._id);
          if (!doc) return;
          updatedMood = { ...doc.toObject(), _id: doc._id.toString() };
        }

        console.log("Updated mood:", updatedMood);

        // Cancel existing job
        const moodId = change.documentKey._id.toString();
        const existingJob = scheduledJobs.get(moodId);
        if (existingJob) {
          existingJob.cancel();
          console.log(`Cancelled existing job for ${updatedMood.teamName}`);
        }

        // Schedule new job with updated time
        scheduleMoodCheckIn(updatedMood);
        console.log(`Rescheduled job for ${updatedMood.teamName}`);
      }

      // Handle document deletions
      if (change.operationType === "delete") {
        const deletedId = change.documentKey._id.toString();
        const existingJob = scheduledJobs.get(deletedId);

        if (existingJob) {
          existingJob.cancel();
          scheduledJobs.delete(deletedId);
          console.log(
            `Cancelled and removed job for deleted mood (ID: ${deletedId})`
          );
        }
      }

      if (change.operationType === "insert") {
        const newMood = change.fullDocument as MoodTimeTypes;
        scheduleMoodCheckIn(newMood);
        console.log(`Scheduled job for ${newMood.teamName}`);
      }
    });
  } catch (error) {
    console.error("Error setting up MongoDB change stream:", error);
  }
};

// Initialize mood check-ins and start listening for updates
export const initializeMoodCheckIns = async () => {
  try {
    const moods = (await MoodTime.find()) as MoodTimeTypes[];

    // Schedule initial jobs
    moods.forEach((mood) => {
      scheduleMoodCheckIn(mood);
    });

    // Start listening for updates
    await listenForMoodTimeUpdates();
  } catch (error) {
    console.error("Error initializing mood check-ins:", error);
  }
};

