const express = require('express');
const router = express.Router();
const balanceController = require('../controllers/balanceController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/groups/:id/balance', balanceController.getGroupBalance);
router.get('/users/:id/balance', balanceController.getUserBalance);
router.get('/groups/:id/simplified-settlements', balanceController.getSimplifiedSettlements);

module.exports = router;
