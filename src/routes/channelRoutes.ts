import express from "express";
import { createChannel, deleteChannel } from "../controllers/teamController";

const router = express.Router();

router.post("/", createChannel);
router.post("/delete", deleteChannel);

export default router;
