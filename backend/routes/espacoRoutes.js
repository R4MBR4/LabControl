const express = require('express');
const router = express.Router();
const espacoController = require('../controllers/espacoController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/auth');

router.use(authenticateToken);

// Consulta permitida a todos os perfis
router.get('/', espacoController.list);
router.get('/:id', espacoController.getById);

// Gestão restrita ao Administrador
router.post('/', authorizeAdmin, espacoController.create);
router.put('/:id', authorizeAdmin, espacoController.update);
router.delete('/:id', authorizeAdmin, espacoController.remove);

module.exports = router;
