import express from "express";
import { exportAnalytics, getMasterAnalytics } from "../controllers/analyticsController";
import { getTeamInsights } from "../controllers/teamInsightsController";

const router = express.Router();

router.get("/analytics", getMasterAnalytics);

router.get("/export", exportAnalytics);
router.get("/insights", getTeamInsights);

export default router;
