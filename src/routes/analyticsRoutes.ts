import express from "express";
import { getMasterAnalytics } from "../controllers/analyticsController";

const router = express.Router();

router.get("/analytics", getMasterAnalytics);

export default router;
