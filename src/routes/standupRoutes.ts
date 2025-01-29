import express from "express";
import {
  getStandupsByFilterOrAll,
  // getTeamParticipation,
} from "../controllers/standupController";

const router = express.Router();


router.get("/", getStandupsByFilterOrAll);
// router.get("/participation-rates", getTeamParticipation)


export default router;
