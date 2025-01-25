import { slackApp } from '../config/slack';
//slack bot simple messaging

export const appMentionRespond = () => { 
    // Add event listener for app_mention events
    slackApp.event('app_mention', async ({ event, say }) => {
        //
        console.log('bot tried this');
        try {
        // Extract the user who mentioned the bot
        const userWhoMentioned = event.user;
        
        // Respond to the mention
        await say({
            text: `Hello <@${userWhoMentioned}>! 👋 How can I help you today?`,
            thread_ts: event.thread_ts || event.ts // This will keep replies in a thread if the mention was in a thread
        });
        
        } catch (error) {
        console.error('Error handling app mention:', error);
        }
    });
}

export const greetingRespond = () =>{
//handle dms
  slackApp.message('hello', async ({ message, say }) => {
  
    let user: string | undefined;
   
    if ('user' in message){
   
       user = message.user
   
    }
   
     // Check if the message is from a direct message (channel starts with "D")
     if (message.channel && message.channel.startsWith('D')) {
       console.log('Received a direct message:', message);
   
       try {
         await say({
           text: `Hello! <@${user}>This is a direct message from FlowSync. How can I help you today?`,
         });
       } catch (error) {
         console.error('Error sending a response in a direct message:', error);
       }
     }
   });
}
  