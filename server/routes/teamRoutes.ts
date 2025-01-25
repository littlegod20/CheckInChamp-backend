import express from 'express';
import { createTeam, deleteTeam, getTeams,getTeamsWithQuestions, scheduleTeamReminder } from '../controllers/teamController';



const router = express.Router();

// get all team
router.get('/', getTeams);

//get all teams with questions
router.get('/questions', getTeamsWithQuestions);

//create a new team
router.post('/', createTeam);

// Delete a team
router.delete('/:teamId', deleteTeam);

//schedule reminder for teams
router.post('/team-reminder', scheduleTeamReminder);



export default router;
