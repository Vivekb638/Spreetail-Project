const express = require('express');
const router = express.Router();
const settlementController = require('../controllers/settlementController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', settlementController.createSettlement);
router.get('/', settlementController.getSettlements);

module.exports = router;
