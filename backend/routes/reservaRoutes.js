const express = require('express');
const router = express.Router();
const reservaController = require('../controllers/reservaController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/auth');

router.use(authenticateToken);

router.get('/', reservaController.list);
router.get('/calendario', reservaController.getCalendario);
router.get('/configuracao/no-show', authorizeAdmin, reservaController.getToleranciaNoShow);
router.put('/configuracao/no-show', authorizeAdmin, reservaController.updateToleranciaNoShow);
router.post('/recorrente', reservaController.createRecorrente);
router.post('/verificar-no-shows', authorizeAdmin, reservaController.verificarNoShows);
router.post('/verificar-avisos', reservaController.verificarAvisos);
router.get('/:id', reservaController.getById);
router.post('/', reservaController.create);
router.post('/:id/estender', reservaController.estender);
router.put('/:id/cancelar', reservaController.cancel);
router.put('/:id/cancelar-recorrencia', reservaController.cancelarRecorrente);
router.post('/:id/no-show', authorizeAdmin, reservaController.marcarNoShow);
router.patch('/:id/status', authorizeAdmin, reservaController.updateStatus);

module.exports = router;

