const express = require('express');
const router = express.Router();
const manutencaoController = require('../controllers/manutencaoController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/auth');

router.use(authenticateToken);

router.get('/', manutencaoController.list);
router.get('/:id', manutencaoController.getById);

// Apenas administradores gerenciam fluxo de manutenções
router.post('/', authorizeAdmin, manutencaoController.create);
router.patch('/:id/concluir', authorizeAdmin, manutencaoController.concluir);
router.put('/:id', authorizeAdmin, manutencaoController.update);
router.delete('/:id', authorizeAdmin, manutencaoController.remove);

module.exports = router;
