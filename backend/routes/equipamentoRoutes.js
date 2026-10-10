const express = require('express');
const router = express.Router();
const equipamentoController = require('../controllers/equipamentoController');
const documentoTecnicoController = require('../controllers/documentoTecnicoController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/auth');

router.use(authenticateToken);

// Identificação inequívoca via QR e geração de etiquetas em lote
router.post('/identificar-qr', equipamentoController.identificarQR);
router.get('/identificar-qr', equipamentoController.identificarQR);
router.post('/etiquetas-lote', equipamentoController.gerarEtiquetasLote);
router.get('/etiquetas-lote', equipamentoController.gerarEtiquetasLote);

// Consulta, Histórico e QR Code disponíveis para todos os usuários
router.get('/', equipamentoController.list);
router.get('/:id', equipamentoController.getById);
router.get('/:id/historico', equipamentoController.getHistorico);
router.get('/:id/qrcode', equipamentoController.getQRCode);
router.get('/:id/documentos', documentoTecnicoController.list);

// Gestão de equipamentos restrita ao Administrador
router.post('/', authorizeAdmin, equipamentoController.create);
router.put('/:id', authorizeAdmin, equipamentoController.update);
router.post('/:id/documentos', authorizeAdmin, documentoTecnicoController.create);
router.delete('/:id/documentos/:documentoId', authorizeAdmin, documentoTecnicoController.remove);
router.post('/:id/inativar', authorizeAdmin, equipamentoController.inativar);
router.post('/:id/reativar', authorizeAdmin, equipamentoController.reativar);
router.delete('/:id', authorizeAdmin, equipamentoController.remove);

module.exports = router;
