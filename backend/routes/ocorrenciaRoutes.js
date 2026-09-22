const express = require('express');
const router = express.Router();
const ocorrenciaController = require('../controllers/ocorrenciaController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/auth');

router.use(authenticateToken);

router.get('/', ocorrenciaController.list);
router.get('/:id', ocorrenciaController.getById);
router.post('/', ocorrenciaController.create);
router.patch('/:id/decidir', authorizeAdmin, ocorrenciaController.decidir);
router.delete('/:id', authorizeAdmin, ocorrenciaController.remove);

module.exports = router;
