import express from "express";
import { createMood, getMoods } from "../controllers/moodControllers";

const router = express.Router();

router.get("/", getMoods);

router.post("/checkIn", createMood);

export default router;
