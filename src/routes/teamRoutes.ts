import express from "express";
import {
  createTeam,
  deleteTeam,
  generateTeamReport,
  getTeams,
} from "../controllers/teamController";

const router = express.Router();

// get all team
router.get("/", getTeams);

//create a new team
router.post("/", createTeam);

// Delete a team
router.delete("/:slackChannelId", deleteTeam);

router.get("/report", generateTeamReport);

export default router;
