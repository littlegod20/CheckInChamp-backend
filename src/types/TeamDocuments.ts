interface TeamDocumentTypes {
  _id: string;
  members: string[];
  name: string;
  slackChannelId: string;
  timezone: string;
  standUpConfig: StandUpConfigTypes;
}
