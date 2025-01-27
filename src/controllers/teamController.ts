import { Request, Response } from 'express';
import { Team } from '../models/Team';
import { Question} from '../models/Question';
import { Standup } from '../models/Standup';



import {web as slackClient} from '../config/slack';
import schedule from 'node-schedule';
// A map to store scheduled jobs for each channel
const channelJobs = new Map<string, schedule.Job[]>();

//function required to create a team
export const createTeam = async (req: Request, res: Response): Promise<void> => {
  const { name, description } = req.body;
  console.log('Received POST /teams request with body:', req.body);

  try {
    const team = new Team({ name, description});
    await team.save();

    const channelName = `team-${team.name.toLowerCase().replace(/\s+/g, '-')}`; // Format channel name
    const slackChannelResponse = await slackClient.conversations.create({
      name: channelName,
      is_private: false, // Set to `false` if you want it to be a public channel
    });

    //get the slack channel details after successfully creating it
    if (slackChannelResponse && slackChannelResponse.channel){
      team.slackChannelId = slackChannelResponse.channel.id as string;  
      await team.save();
    }

    //respond if successful
    res.status(201).json({
      message: 'Team created successfully',
      team,
      slackChannel: slackChannelResponse.channel,
    });
  } catch (error: any) {
    // Enhanced error logging
    console.error('Error in createTeam:', {
      message: error.message,
      stack: error.stack,
      body: req.body,
    });

    res.status(400).json({ error: error.message || 'Unknown error occurred' });
  }
};

//function required to get all teams
export const getTeams = async (req: Request, res: Response): Promise<void> => {
  try {
    const teams = await Team.find();
    res.json(teams);
  } catch (error: any) {
    // Enhanced error logging
    console.error('Error in getAllTeams:', {
      message: error.message,
      stack: error.stack,
    });

    res.status(400).json({ error: error.message });
  }
};

//get all teams and the questions attached to them
export const getTeamsWithQuestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const teams = await Team.find();
    const teamsWithQuestions = await Promise.all(
      teams.map(async (team) => {
        const questions = await Question.find({ team: team.slackChannelId });
        return {
          team,
          questions,
        };
      })
    );
    res.json(teamsWithQuestions);
  } catch (error: any) {
    // Enhanced error logging
    console.error('Error in getTeamsWithQuestions:', {
      message: error.message,
      stack: error.stack,
    });

    res.status(400).json({ error: error.message });
  }
};

// Function required to delete a team
export const deleteTeam = async (req: Request, res: Response): Promise<void> => {
  const { teamId } = req.params; // Slack channel ID

  try {
    // Attempt to delete the Slack channel associated with the team
    try {
      await slackClient.conversations.archive({ channel: teamId });
    } catch (archiveError: any) {
      if (archiveError.data.error === 'not_in_channel') {
        console.warn(`Bot is not in the channel ${teamId}, proceeding with team deletion.`);
      } else {
        throw archiveError;
      }
    }

    // Find the team by Slack channel ID and delete it
    const team = await Team.findOneAndDelete({ slackChannelId: teamId });

    if (!team) {
      res.status(404).json({ message: `Team with Slack ID ${teamId} not found` });
      return;
    }

    res.status(200).json({ message: `Team with Slack ID ${teamId} deleted successfully` });
  } catch (error: any) {
    // Enhanced error logging
    console.error('Error in deleteTeam:', {
      message: error.message,
      stack: error.stack,
      teamId,
    });
    res.status(500).json({ error: `Failed to delete team with Slack ID ${teamId}: ${error.message}` });
  }
};

//sending usual reminders to teams channel to remind them




// Sending usual reminders to team's channel and members to remind them
async function scheduleChannelReminder(channel: string, text: string, scheduleTime: Date, url: string): Promise<void> {
  schedule.scheduleJob(scheduleTime, async () => {
    try {
      // Define the message with the button
      const message = {
        channel,
        text,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: 'Please fill in for your standups',
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Proceed to Fill",
                },
                url: url, 
              },
            ],
          },
        ],
      };

      // Send reminder to the team channel with the button
      const channelResult = await slackClient.chat.postMessage(message);
      console.log(`Reminder sent to channel ${channel}:`, channelResult);

      // Find the team by channel ID to get the members
      const channelId = channel.toString();
      const team = await Team.findOne({ slackChannelId: channelId });
      if (team && team.members) {
        // Convert ObjectId to string and send reminders with the button
        for (const memberId of team.members.map((id: any) => id.toString())) {
          // Append memberId to the URL as a query parameter
          const memberUrl = `${url}?memberId=${memberId}`;

          // Create the member message with the modified URL
          const memberMessage = { 
            ...message, 
            channel: memberId,
            blocks: message.blocks.map(block => {
              if (block.type === "actions") {
                return {
                  ...block,
                  elements: block.elements?.map(element => ({
                    ...element,
                    url: memberUrl, // Use the new URL with the memberId
                  })),
                };
              }
              return block;
            }),
          };

          const memberResult = await slackClient.chat.postMessage(memberMessage);
          console.log(`Reminder sent to member ${memberId}:`, memberResult);
        }
      } else {
        console.warn(`No team found with channel ID ${channel} or no members in the team.`);
      }
    } catch (error) {
      console.error(`Failed to send reminder to channel ${channel} or its members:`, error);
    }
  });
}



// Set team reminder using arguments set in the post request
export function scheduleTeamReminder(req: Request, res: Response): void {
  const { channel, text, scheduleTime } = req.body;

  const url = `http://localhost:5173/standup-answer/${channel}`
  console.log('Received POST /teams/team-reminder request with body:', req.body);
  try {
    const scheduleDate = new Date(scheduleTime); // Convert scheduleTime to Date object
    scheduleChannelReminder(channel, text, scheduleDate, url);
    res.status(201).json({ message: 'Team reminder scheduled successfully' });
  } catch (error: any) {
    // Enhanced error logging
    console.error('Error in scheduleTeamReminder:', {
      message: error.message,
      stack: error.stack,
      body: req.body,
    });

    res.status(400).json({ error: error.message });
  }
};


