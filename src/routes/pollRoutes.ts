import express from "express";
import { createPoll, votePoll, getPollResults,getAllPolls } from "../controllers/pollController";

const router = express.Router();

router.get("/", getAllPolls);
router.post("/create", createPoll); // Create a poll
router.post("/vote/:pollId", votePoll); // Vote on a poll
router.get("/results/:pollId", getPollResults); // Get real-time results

export default router;
