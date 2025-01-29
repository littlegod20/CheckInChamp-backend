import express from 'express';
import { createChannel, createTeam, deleteTeam, getTeams } from '../controllers/teamController';



const router = express.Router();

// get all team
router.get('/', getTeams);

// //get all teams with questions
// router.get('/questions', getTeamsWithQuestions);

//create a new team
router.post('/', createTeam)

// Delete a team
router.delete('/:slackChannelId', deleteTeam);

// //schedule reminder for teams
// router.post('/team-reminder', scheduleTeamReminder);



export default router;
