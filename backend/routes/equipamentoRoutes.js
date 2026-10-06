const express = require('express');
const router = express.Router();
const equipamentoController = require('../controllers/equipamentoController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/auth');

router.use(authenticateToken);

// Consulta, Histórico e QR Code disponíveis para todos os usuários
router.get('/', equipamentoController.list);
router.get('/:id', equipamentoController.getById);
router.get('/:id/historico', equipamentoController.getHistorico);
router.get('/:id/qrcode', equipamentoController.getQRCode);

// Gestão de equipamentos restrita ao Administrador
router.post('/', authorizeAdmin, equipamentoController.create);
router.put('/:id', authorizeAdmin, equipamentoController.update);
router.post('/:id/inativar', authorizeAdmin, equipamentoController.inativar);
router.post('/:id/reativar', authorizeAdmin, equipamentoController.reativar);
router.delete('/:id', authorizeAdmin, equipamentoController.remove);

module.exports = router;
