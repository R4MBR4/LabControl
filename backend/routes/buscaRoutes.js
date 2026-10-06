const express = require('express');
const router = express.Router();
const buscaController = require('../controllers/buscaController');
const { authenticateToken } = require('../middlewares/auth');

router.use(authenticateToken);
router.get('/', buscaController.search);

module.exports = router;
