import { Request, Response } from "express";
import { getMasterAnalyticsData } from "./analyticsController";


export const getTeamInsights = async (req: Request, res: Response) => {
  try {
    const { team, startDate, endDate } = req.query;

    const data = await getMasterAnalyticsData(
      team?.toString(),
      startDate?.toString(),
      endDate?.toString()
    );

    if(!data){
      throw new Error("No analytics avalable")
    }

    const insights = {
      performance: {
        standupCompletionRate: calculateCompletionRate(data.standups),
        moodDistribution: data.moods,
      },
      engagement: {
        kudosActivity: {
          given: data.kudos.given,
          topReceiver: data.kudos.topReceiver,
          topCategory: data.kudos.topCategory,
        },
        pollParticipation: {
          total: data.polls.total,
          average: data.polls.avgParticipation,
          mostPopular: data.polls.mostPopular,
        },
      },
      trends: {
        standups: data.standups.trends,
        moods: data.moods,
        kudos: data.kudos,
        polls: data.polls,
      },
    };

    res.status(200).json(insights);
  } catch (error) {
    console.error("Team insights error:", error);
    res.status(500).json({ error: "Failed to get team insights" });
  }
};

const calculateCompletionRate = (standups: any) => {
  if (!standups || !standups.completed || !standups.pending) return 0;
  const total = standups.completed + standups.pending;
  return total > 0 ? (standups.completed / total) * 100 : 0;
};