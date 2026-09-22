const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/auth');

router.use(authenticateToken);

// Apenas administradores podem gerenciar usuários
router.get('/', authorizeAdmin, usuarioController.list);
router.get('/:id', authorizeAdmin, usuarioController.getById);
router.post('/', authorizeAdmin, usuarioController.create);
router.put('/:id', authorizeAdmin, usuarioController.update);
router.delete('/:id', authorizeAdmin, usuarioController.remove);

module.exports = router;
