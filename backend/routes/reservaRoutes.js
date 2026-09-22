const express = require('express');
const router = express.Router();
const reservaController = require('../controllers/reservaController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/auth');

router.use(authenticateToken);

router.get('/', reservaController.list);
router.get('/:id', reservaController.getById);
router.post('/', reservaController.create);
router.put('/:id/cancelar', reservaController.cancel);
router.patch('/:id/status', authorizeAdmin, reservaController.updateStatus);

module.exports = router;
