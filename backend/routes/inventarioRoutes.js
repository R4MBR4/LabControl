const express = require('express');
const router = express.Router();
const inventarioController = require('../controllers/inventarioController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/auth');

router.use(authenticateToken);

// Consulta permitida a usuários autenticados
router.get('/', inventarioController.list);
router.get('/:id', inventarioController.getById);

// Ações do inventário restritas a administradores
router.post('/', authorizeAdmin, inventarioController.start);
router.post('/:id/scan', authorizeAdmin, inventarioController.scan);
router.post('/:id/decidir-divergencia', authorizeAdmin, inventarioController.decidirDivergencia);
router.post('/:id/finalizar', authorizeAdmin, inventarioController.finalizar);

module.exports = router;
