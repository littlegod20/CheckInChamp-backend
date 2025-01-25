import {redisClient} from '../config/redis';
import {web as slackClient} from '../config/slack';
import { Team } from '../models/Team';
import { Member } from '../models/Member';

export async function cacheMembersInRedis() {
    try {
      const response = await slackClient.users.list({});
      await redisClient.connect()
  
      if (response.ok) {
        const members = response.members;
  
        if (members) {
          for (const member of members) {
            if (member.id && member.name) {
              await redisClient.set(`slackUser:${member.id}`, member.name);
            }
          }
          //console.log('All members have been cached in Redis successfully');

              //and then put them inside the database too
            for (const member of members) {
              if (member.id && member.name) {
                const existingMember = await Member.findOne({ slackId: member.id });
                if (existingMember) {
                  // Update the existing member
                  await Member.updateOne(
                    { slackId: member.id },
                    {
                      name: member.name,
                    }
                  );
                }
                else {
                  // Create a new member
                  await Member.create({
                    slackId: member.id,
                    name: member.name,
                  });
                }
              }
            }
            console.log('All members have been cached in Redis and database successfully');
        }
      } else {
        throw new Error('Error fetching members');
      }
    } 
    catch (error) {
      console.error('Error caching members in Redis:', error);
    }
  }

  //geting all teams and their members
async function getChannelMembers(channelId: string) {
    try {
      // Fetch members of the channel
      const response = await slackClient.conversations.members({
        channel: channelId,
      });
  
      if (response.ok) {
        return response.members;
      } else {
        throw new Error('Error fetching members');
      }
    } catch (error) {
      console.error(`Error fetching members for channel ${channelId}:`, error);
      return [];
    }
  }
  
  // Function to fetch channels and their members
  async function getTeamsWithMembers() {
    try {
      // Fetch the list of channels
      const response = await slackClient.conversations.list();
      
      if (response.ok) {
        const channels = response.channels;
  
        // Fetch members for each channel
        if(channels){
          const teamsWithMembers = await Promise.all(
            channels.map(async (channel: { id?: string; name?: string; is_archived?: boolean }) => {
              if(channel.id && !channel.is_archived){
                const members = await getChannelMembers(channel.id);
                return {
                  id: channel.id,
                  name: channel.name,
                  members: members,
                };
              }
            })
          );
          return teamsWithMembers;
        }
  
      } else {
        throw new Error('Error fetching channels');
      }
    } catch (error) {
      console.error('Error fetching channels and members:', error);
      return [];
    }
  }
  
  //function to get teams with members
  export async function processTeamsWithMembers() {
    try {
      const teamsWithMembers = await getTeamsWithMembers();
      if (teamsWithMembers) {
        for (const team of teamsWithMembers) {
          if (team && team.id) {
            const existingTeam = await Team.findOne({ slackChannelId: team.id });
            if (existingTeam) {
              // Update the existing team
              await Team.updateOne(
                { slackChannelId: team.id },
                {
                  name: team.name,
                  members: team.members,
                  timezone: 'UTC',
                }
              );
            } else {
              // Create a new team
              await Team.create({
                slackChannelId: team.id,
                name: team.name,
                members: team.members,
                timezone: 'UTC',
              });
            }
          }
        }
        console.log('All teams and their members have been processed successfully');
      }
    } catch (error) {
      console.error('Error while processing teams:', error);
    }
  }