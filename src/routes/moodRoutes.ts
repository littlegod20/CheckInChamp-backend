import express from "express";
import {
  createMoodResponse,
  createMoodTime,
  deleteMoodTime,
  getMoodResponses,
  getMoodTime,
  // handleMoodInteraction,
} from "../controllers/moodControllers";

const router = express.Router();

router.get("/", getMoodResponses);

router.post("/checkIn", createMoodResponse);

router.post("/", createMoodTime);

// router.post("/interaction", handleMoodInteraction);

router.delete("/", deleteMoodTime);

router.get("/times", getMoodTime)

export default router;
