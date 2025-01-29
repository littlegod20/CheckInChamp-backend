interface StandupResponseTypes {
  teamName: string;
  userId: string;
  slackChannelId: string;
  messageTs: string;
  date: Date;
  responses: ResponsesTypes[];
}


interface StandUpConfigTypes {
  questions: {
    id: string;
    options?: string[];
    required: boolean;
    text: string;
    type: string;
  }[];
  reminderTimes: string[];
  standUpTimes: string[];
  standUpDays: string[];
}

interface ResponsesTypes {
  questionId: string;
  answer: string;
}