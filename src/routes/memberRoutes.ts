import express from 'express';
import { addMembers, removeMember, getMembers, getAllUsers} from '../controllers/memberController';

const router = express.Router();

//get all members in the workspace
/**
 * @swagger
 * /:
 *   get:
 *     summary: Get all members in the workspace
 *    
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/', getAllUsers);

//get all members from a team
/**
 * @swagger
 * /:
 *   get:
 *     summary: Get all members from a team
 *    
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/:teamId/', getMembers);

// Add a member to a team
/**
 * @swagger
 * /:
 *   post:
 *     summary: Add a member to team
 *    
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/:teamId/', addMembers);

// Remove a member from a team
/**
 * @swagger
 * /:
 *   get: 
 *     summary: Delete team member
 *     parameters:
 *       MemberId:
 *          description: team member id
 *     
 *     responses:
 *       200:
 *         description: Success
 */
router.delete('/:teamId/:memberId', removeMember);

export default router;
