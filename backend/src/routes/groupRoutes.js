const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all group endpoints
router.use(authMiddleware);

router.get('/', groupController.getGroups);
router.post('/', groupController.createGroup);
router.put('/:id', groupController.updateGroup);
router.delete('/:id', groupController.deleteGroup);

// Member sub-resources
router.get('/:id/members', groupController.getGroupMembers);
router.post('/:id/members', groupController.addMember);
router.put('/:id/members/:memberId', groupController.updateMember);
router.delete('/:id/members/:memberId', groupController.removeMember);

module.exports = router;
