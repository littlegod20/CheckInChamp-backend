interface StandUpQuestionsTypes {
  questions: {
    _id: string;
    options?: string[];
    required: boolean;
    text: string;
    type: string;
  }[];
  reminderTimes: string[];
  standUpTimes: string[];
  standUpDays: string[];
}

interface TeamDocumentTypes {
  _id: string;
  members: string[];
  name: string;
  slackChannelId: string;
  timeZone: string;
  standUpConfig: StandUpQuestionsTypes;
}
