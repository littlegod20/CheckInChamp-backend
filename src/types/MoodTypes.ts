interface MoodTypes {
  userId: string;
  userName: string;
  teamName: string;
  slackChannelId: string;
  mood: string;
  date: string;
}

export interface MoodTimeTypes {
  _id: string;
  teamName: string;
  slackChannelId: string;
  moodTime: string;
}
