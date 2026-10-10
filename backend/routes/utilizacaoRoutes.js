const express = require('express');
const router = express.Router();
const utilizacaoController = require('../controllers/utilizacaoController');
const { authenticateToken } = require('../middlewares/auth');

router.use(authenticateToken);

router.get('/', utilizacaoController.list);
router.get('/:id', utilizacaoController.getById);
router.post('/checkin', utilizacaoController.checkin);
router.post('/checkout', utilizacaoController.checkout);
router.post('/:id/estender', utilizacaoController.estender);

module.exports = router;

