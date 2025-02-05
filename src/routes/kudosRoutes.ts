import express from "express";
import { giveKudos, getKudos, getLeaderboard } from "../controllers/kudosController";

const router = express.Router();

// Route to give kudos
router.post("/", giveKudos);

// Route to get all kudos with filters
router.get("/", getKudos);

// Route to get monthly leaderboard
router.get("/leaderboard", getLeaderboard);

export default router;
