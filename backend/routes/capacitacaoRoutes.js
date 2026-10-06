const express = require('express');
const router = express.Router();
const capacitacaoController = require('../controllers/capacitacaoController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/auth');

router.use(authenticateToken);

router.get('/', capacitacaoController.list);
router.get('/usuario/:userId?', capacitacaoController.getByUser);
router.get('/check/:equipamentoId', capacitacaoController.check);

// Administradores concedem e editam habilitações de usuários
router.post('/', authorizeAdmin, capacitacaoController.create);
router.put('/:id', authorizeAdmin, capacitacaoController.update);
router.delete('/:id', authorizeAdmin, capacitacaoController.remove);

module.exports = router;
