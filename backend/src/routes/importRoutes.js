const express = require('express');
const router = express.Router();
const importController = require('../controllers/importController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/csv', importController.uploadCSV);
router.get('/:id/report', importController.getImportReport);
router.get('/:id/report/export', importController.exportReport);
router.get('/:id/anomalies', importController.getImportAnomalies);
router.post('/:id/approve', importController.approveImport);
router.post('/:id/reject', importController.rejectImport);

module.exports = router;
