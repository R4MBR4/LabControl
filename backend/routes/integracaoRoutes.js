const express = require('express');
const router = express.Router();
const integracaoController = require('../controllers/integracaoController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/auth');

router.use(authenticateToken, authorizeAdmin);

router.post(
  '/equipamentos/preview',
  express.text({ type: 'text/csv', limit: '10mb' }),
  integracaoController.previewEquipmentImport
);
router.post(
  '/equipamentos/importar',
  express.text({ type: 'text/csv', limit: '10mb' }),
  integracaoController.importEquipmentCsv
);
router.get('/exportar/:dataset', integracaoController.exportCsv);

module.exports = router;
