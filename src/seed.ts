import { connect, disconnect } from "mongoose";
import { Team, TeamDocument } from "./models/Team";
import { StandupResponse } from "./models/StandUpResponses";
import { Kudos } from "./models/kudos";
import { MoodResponse } from "./models/MoodResponse";
import { Poll } from "./models/Poll";
import { faker } from "@faker-js/faker";
import dotenv from "dotenv";

dotenv.config();

const TEAM_1 = {
  name: "team-theos-dlsl",
  slackChannelId: "C08C0P0B1B2",
  members: ["U08AQ6X1ZA5", "U08B0A92VQQ"],
};

const TEAM_2 = {
  name: "team-misheal3",
  slackChannelId: "C08AU381059",
  members: ["U08AQ6X1ZA5", "U08B0A92VQQ"],
};

const STANDUP_QUESTIONS = [
  {
    id: "1",
    text: "What did you work on yesterday?",
    type: "checkbox",
    options: ["frontend", "backend", "both"],
    require: true,
  },
  {
    id: "2",
    text: "What are you working on today?",
    type: "select",
    options: ["analytics page", "poll page", "others", "done"],
    require: true,
  },
  {
    id: "3",
    text: "Any blockers?",
    type: "radio",
    options: ["yes", "no"],
    require: false,
  },
];

const KUDOS_CATEGORIES = ["Teamwork", "Leadership", "Creativity"];
const MOODS = ["happy", "neutral", "sad"];
const POLL_TYPES = ["single", "multiple", "scale"];

async function seedDummyData() {
  try {
    await connect(
      `mongodb+srv://theophilusfrimpong17:gBXiL0PjrP5moBIV@checkindb.znu8h.mongodb.net/slackDB?retryWrites=true&w=majority&appName=checkInDB`
    );

    // Clear existing data
    await Promise.all([
      Team.deleteMany(),
      StandupResponse.deleteMany(),
      Kudos.deleteMany(),
      MoodResponse.deleteMany(),
      Poll.deleteMany(),
    ]);

    // Create Teams
    const teams = await Team.insertMany([
      {
        name: TEAM_1.name,
        members: TEAM_1.members,
        slackChannelId: TEAM_1.slackChannelId,
        standUpConfig: {
          questions: STANDUP_QUESTIONS,
          reminderTimes: ["09:00"],
          standUpDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          standUpTimes: ["09:30 AM"],
        },
        timezone: "UTC",
      },
      {
        name: TEAM_2.name,
        members: TEAM_2.members,
        slackChannelId: TEAM_2.slackChannelId,
        standUpConfig: {
          questions: STANDUP_QUESTIONS,
          reminderTimes: ["10:00"],
          standUpDays: ["Monday", "Wednesday", "Friday"],
          standUpTimes: ["10:30 PM"],
        },
        timezone: "GMT",
      },
    ]);

    // Generate 3 months of data
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);
    const endDate = new Date();

    const dataPromises = [];

    // Generate data for each day
    for (
      let date = new Date(startDate);
      date <= endDate;
      date.setDate(date.getDate() + 1)
    ) {
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      for (const team of [TEAM_1, TEAM_2]) {
        // Standup Responses (60% participation)
        if (Math.random() < 0.6) {
          const standupDate = new Date(date); // Clone base date
          standupDate.setDate(date.getDate() - Math.floor(Math.random() * 7)); // Vary by up to 7 days
          standupDate.setMinutes(
            date.getMinutes() - Math.floor(Math.random() * 60)
          ); // Vary by up to 60 minutes

          const standup = new StandupResponse({
            teamName: team.name,
            messageTs: standupDate.getTime().toString(),
            slackChannelId: team.slackChannelId,
            date: standupDate,
            responses: team.members
              .filter(() => Math.random() < 0.8) // 80% member participation
              .map((userId) => ({
                userId,
                answers: STANDUP_QUESTIONS.map((q) => ({
                  questionId: q.id,
                  questionType: q.type,
                  answer: faker.lorem.sentences(2),
                })),
                responseTime: date.toISOString(),
              })),
          });
          dataPromises.push(standup.save());
        }

        // Mood Responses (1 per user per day)
        for (const userId of team.members) {
          const mood = new MoodResponse({
            userId,
            teamName: team.name,
            slackChannelId: team.slackChannelId,
            mood: MOODS[Math.floor(Math.random() * MOODS.length)],
            date: date,
          });
          dataPromises.push(mood.save());
        }

        // Kudos (1-3 per day)
        const numKudos = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < numKudos; i++) {
          const [giver, receiver] = faker.helpers.shuffle(team.members);
          const kudos = new Kudos({
            giverId: giver,
            receiverId: receiver,
            category:
              KUDOS_CATEGORIES[
                Math.floor(Math.random() * KUDOS_CATEGORIES.length)
              ],
            reason: faker.lorem.sentence(),
            timestamp: date,
            teamName: team.name,
          });
          dataPromises.push(kudos.save());
        }

        // Polls (1 per week)
        if (date.getDay() === 1 && Math.random() < 0.3) {
          // 30% chance on Mondays
          const poll = new Poll({
            question: faker.lorem.sentence(),
            options: Array.from({ length: 4 }, () => faker.lorem.words(3)),
            type: POLL_TYPES[Math.floor(Math.random() * POLL_TYPES.length)],
            createdBy:
              team.members[Math.floor(Math.random() * team.members.length)],
            channelId: team.slackChannelId,
            votes: team.members
              .filter(() => Math.random() < 0.7) // 70% participation
              .map((userId) => ({
                userId,
                selectedOptions: [Math.floor(Math.random() * 4).toString()],
                timestamp: date,
              })),
          });
          dataPromises.push(poll.save());
        }
      }
    }

    await Promise.all(dataPromises);
    console.log("✅ Dummy data inserted successfully");
  } catch (error) {
    console.error("Error seeding data:", error);
  } finally {
    await disconnect();
  }
}

// Run the seeder
seedDummyData();
