const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/auth');

router.use(authenticateToken);
router.get('/metricas', authorizeAdmin, dashboardController.getAdminMetrics);

module.exports = router;
