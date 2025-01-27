import express from 'express';
import { submitStandup, getStandupAnswers,/*getAllStandupQuestions,*/ configureStandupQuestions, getStandupQuestions, getNotResponded, getAllStandups } from '../controllers/standupController';

const router = express.Router();

//configure standup questions for a team
router.post('/team/:teamId/configure', configureStandupQuestions);

//get standup questions
router.get('/team/:teamId/questions', getStandupQuestions);

//get all standup questions
//router.get('/questions', getAllStandupQuestions);

//submit standup update
router.post('/team/:teamId/members/:memberId/standup', submitStandup);

//get standup answers
router.get('/answers', getAllStandups);

//get not responded
router.get('/not-responded', getNotResponded);


export default router;
    