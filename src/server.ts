import express from 'express';
import dotenv from 'dotenv';
import teamRoutes from './routes/teamRoutes';
import memberRoutes from './routes/memberRoutes';
import standupRoutes from './routes/standupRoutes';
import { connectDB } from './config/database';
import { slackApp } from './config/slack';
import { appMentionRespond, greetingRespond } from './slack_activities/interactions';
import { home_pub } from './slack_activities/slack_home';

import { cacheMembersInRedis, processTeamsWithMembers } from './utils/consistent';

import cors from 'cors';

//swagger ui implementation
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "../swaggerConfig";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Connect to Database
connectDB();

// Health check endpoint
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

//a simple root route to the backend 
app.get('/', (req, res) =>{
  console.log('heath check');
  res.send("ok");
 });

// Register routes
app.use('/api/teams', teamRoutes); // No need for ':teamId' here
app.use('/api/members', memberRoutes); 
app.use('/api/standups', standupRoutes); // Register the standup routes
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
    
    console.log(`⚡️ FlowSync app is running on port ${SLACK_PORT}`);
  } catch (error) {
    console.error('Error starting FlowSync app:', error);
    process.exit(1);
  }
})();

// Start Express Server
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});





