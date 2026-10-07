const express = require('express');
const router = express.Router();
const notificacaoController = require('../controllers/notificacaoController');
const { authenticateToken } = require('../middlewares/auth');

router.use(authenticateToken);

router.get('/', notificacaoController.list);
router.patch('/lidas', notificacaoController.markAllRead);
router.patch('/:id/lida', notificacaoController.markRead);

module.exports = router;
