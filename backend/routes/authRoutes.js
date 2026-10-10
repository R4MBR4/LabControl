const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/auth');

// Rotas públicas de ciclo de vida de contas
router.post('/cadastro', authController.cadastro);
router.post('/confirmar-email', authController.confirmarEmail);
router.get('/confirmar-email', authController.confirmarEmail);
router.post('/login', authController.login);

// Rota autenticada do usuário corrente
router.get('/me', authenticateToken, authController.me);

module.exports = router;
