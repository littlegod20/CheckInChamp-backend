import express from "express";
import { config } from "dotenv";
import teamRoutes from "./routes/teamRoutes";
import memberRoutes from "./routes/memberRoutes";
import standupRoutes from "./routes/standupRoutes";
import moodRoutes from "./routes/moodRoutes";
import kudosRoutes from "./routes/kudosRoutes";
import { connectDB } from "./config/database";
import { slackApp } from "./config/slack";
import {
  appMentionRespond,
  greetingRespond,
} from "./slack_activities/interactions";
import { home_pub } from "./slack_activities/slack_home";
import "./slack_activities/kudos_actions";


import {
  cacheMembersInRedis,
  processTeamsWithMembers,
} from "./utils/consistent";

import cors from "cors";

//swagger ui implementation
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swaggerConfig";
import { initializeSchedules } from "./helpers/initializeSchedule";
import { listenForTeamUpdates } from "./helpers/listenForTeamUpdates";
import { handleButtonClick } from "./slack_activities/interactions/handleRespondStandupBtn";
import { handleModalSubmission } from "./slack_activities/interactions/handleStandUpSubmission";

import {
  initializeMoodCheckIns,
} from "./services/moodService";
import { handleMoodSelection } from "./controllers/moodControllers";

config();

const app = express();
app.use(express.json());
app.use(cors());

// Connect to Database
connectDB();

// Health check endpoint
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Register the action handler for button clicks
slackApp.action(/standup_/, async ({ body, ack }) => {
  // Acknowledge the action to Slack
  await ack();

  // Pass the payload to the handler
  await handleButtonClick(body);
});

slackApp.view("standup_submission", async ({ ack, body, client }) => {
  await ack(); // Acknowledge the modal submission

  try {
    // Call the submission handler function
    await handleModalSubmission(body);
  } catch (error) {
    console.error("Error handling modal submission:", error);
  }
});

slackApp.action(/^mood_selection_.*/, async ({ body, ack }) => {
  await ack();

  await handleMoodSelection(body);
});

// Register routes
app.use("/api/teams", teamRoutes);
app.use("/api/mood", moodRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/standups", standupRoutes);
app.use("/api/kudos", kudosRoutes);
app.use((req, res) => {
  res.status(404).send(`Route not found: ${req.method} ${req.url}`);
});

//get all teams with their members into the database
processTeamsWithMembers();

//cache members in Redis
cacheMembersInRedis();

//slack interactions
appMentionRespond();
greetingRespond();

//slack rendering
home_pub();

// Start Slack Bot
(async () => {
  try {
    const SLACK_PORT = 3000;
    await slackApp.start(SLACK_PORT);
    initializeSchedules();
    listenForTeamUpdates();
    initializeMoodCheckIns()
      .then(() =>
        console.log("Mood check-ins initialized and listening for updates")
      )
      .catch((error) =>
        console.error("Failed to initialize mood check-ins:", error)
      );
    console.log(`⚡️ Check In app is running on port ${SLACK_PORT}`);
  } catch (error) {
    console.error("Error starting Check In app:", error);
    process.exit(1);
  }
})();

// Start Express Server
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
