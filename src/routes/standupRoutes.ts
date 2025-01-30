import express from "express";
import {
  exportStandupData,
  getStandupsByFilterOrAll,
  // getTeamParticipation,
} from "../controllers/standupController";

const router = express.Router();


router.get("/", getStandupsByFilterOrAll);
// router.get("/participation-rates", getTeamParticipation)

router.get('/export', exportStandupData)


export default router;
