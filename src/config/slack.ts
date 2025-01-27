import { App, LogLevel } from '@slack/bolt';
import dotenv from 'dotenv';
import { WebClient } from '@slack/web-api';


dotenv.config();
export const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN as string,
  signingSecret: process.env.SLACK_SIGNING_SECRET as string,
  appToken: process.env.SLACK_APP_TOKEN as string,
  socketMode: true,
  //logLevel: LogLevel.DEBUG,
});

// Configure WebClient with custom timeout
export const web = new WebClient(process.env.SLACK_BOT_TOKEN, {
  // Timeout is in milliseconds (default is 10000ms)
  timeout: 30000,
  // Optional: Retry configuration
  retryConfig: {
    retries: 3,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 60000
  }
});
