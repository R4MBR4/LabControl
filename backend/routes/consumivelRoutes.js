const express = require('express');
const router = express.Router();
const consumivelController = require('../controllers/consumivelController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/auth');

router.use(authenticateToken);

router.get('/', consumivelController.list);
router.get('/historico', authorizeAdmin, consumivelController.historicoGeral);
router.get('/:id/historico', consumivelController.historico);
router.get('/:id', consumivelController.getById);

// Gestão de estoque restrita ao Administrador
router.post('/', authorizeAdmin, consumivelController.create);
router.put('/:id', authorizeAdmin, consumivelController.update);
router.post('/:id/movimentar', authorizeAdmin, consumivelController.movimentar);
router.delete('/:id', authorizeAdmin, consumivelController.remove);

module.exports = router;
