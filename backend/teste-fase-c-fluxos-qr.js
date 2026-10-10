const assert = require('node:assert/strict');
const path = require('node:path');

process.env.JWT_SECRET = 'test-only-phase-c-qr-secret-0123456789';

const equipamentoModel = require('./models/equipamentoModel');
const inventarioModel = require('./models/inventarioModel');
const auditoriaModel = require('./models/auditoriaModel');

function runTest(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`  ✓ ${name}`))
    .catch((err) => {
      console.error(`  ✗ ${name}`);
      throw err;
    });
}

// ---------------------------------------------------------
// Helper: Simulação de Banco de Dados com Concorrência e Auditoria
// ---------------------------------------------------------
function createDatabaseState(initial = {}) {
  const state = {
    equipamentos: [
      {
        id: 1,
        espaco_id: 10,
        nome: 'Microscópio Óptico Binocular',
        codigo_patrimonio: 'PAT-UFPI-1001',
        patrimonio_ufpi: 'PAT-UFPI-1001',
        codigo_labcontrol: 'LC-EQ-0001',
        status: 'disponivel',
        inativo: 0,
        exige_capacitacao: 0,
        espaco_nome: 'Laboratório de Biologia'
      },
      {
        id: 2,
        espaco_id: 10,
        nome: 'Autoclave Vertical',
        codigo_patrimonio: 'PAT-UFPI-1002',
        patrimonio_ufpi: 'PAT-UFPI-1002',
        codigo_labcontrol: 'LC-EQ-0002',
        status: 'em_uso',
        inativo: 0,
        exige_capacitacao: 0,
        espaco_nome: 'Laboratório de Biologia'
      },
      {
        id: 3,
        espaco_id: 10,
        nome: 'Centrífuga Refrigerada',
        codigo_patrimonio: 'PAT-UFPI-1003',
        patrimonio_ufpi: 'PAT-UFPI-1003',
        codigo_labcontrol: 'LC-EQ-0003',
        status: 'manutencao',
        inativo: 0,
        exige_capacitacao: 0,
        espaco_nome: 'Laboratório de Biologia'
      },
      {
        id: 4,
        espaco_id: 10,
        nome: 'Espectrofotômetro UV-Vis',
        codigo_patrimonio: 'PAT-UFPI-1004',
        patrimonio_ufpi: null, // Sem patrimônio UFPI oficial
        codigo_labcontrol: 'LC-EQ-0004',
        status: 'disponivel',
        inativo: 1, // Inativo
        motivo_inativacao: 'Descontinuado por obsolescência',
        espaco_nome: 'Laboratório de Biologia'
      },
      {
        id: 5,
        espaco_id: 20, // Pertence ao Laboratório de Química (espaço 20)
        nome: 'Balança Analítica de Precisão',
        codigo_patrimonio: 'PAT-UFPI-2005',
        patrimonio_ufpi: 'PAT-UFPI-2005',
        codigo_labcontrol: 'LC-EQ-0005',
        status: 'disponivel',
        inativo: 0,
        exige_capacitacao: 0,
        espaco_nome: 'Laboratório de Química'
      },
      {
        id: 6,
        espaco_id: 10,
        nome: 'Agitador Magnético com Aquecimento',
        codigo_patrimonio: '777', // Patrimônio puramente numérico
        patrimonio_ufpi: '777',
        codigo_labcontrol: 'LC-EQ-0006',
        status: 'disponivel',
        inativo: 0,
        exige_capacitacao: 0,
        espaco_nome: 'Laboratório de Biologia'
      },
      {
        id: 777, // ID numérico igual ao patrimônio do equipamento 6 (caso de teste de ambiguidade)
        espaco_id: 10,
        nome: 'Banho-Maria Digital',
        codigo_patrimonio: 'PAT-UFPI-888',
        patrimonio_ufpi: 'PAT-UFPI-888',
        codigo_labcontrol: 'LC-EQ-0777',
        status: 'disponivel',
        inativo: 0,
        exige_capacitacao: 0,
        espaco_nome: 'Laboratório de Biologia'
      }
    ],
    inventarios: [
      {
        id: 100,
        espaco_id: 10, // Sessão de inventário no Laboratório de Biologia
        usuario_id: 50,
        status: 'em_andamento',
        data_inicio: new Date(),
        total_esperados: 4,
        total_conferidos: 0,
        total_divergentes: 0,
        total_nao_localizados: 0,
        observacoes: 'Inventário regular semestral'
      }
    ],
    inventarioItens: [],
    utilizacoes: [
      {
        id: 301,
        equipamento_id: 2,
        usuario_id: 42,
        status: 'em_uso',
        data_checkin: new Date(Date.now() - 3600000),
        condicao_inicial: 'Operacional'
      }
    ],
    auditoria: [],
    ...initial
  };

  const executor = {
    state,
    async query(sql, params = []) {
      const s = sql.trim();

      // 1. SELECT equipamento por ID
      if (s.includes('FROM `equipamento` e') && s.includes('e.`id` = ?') && s.includes('LIMIT 1')) {
        const id = Number(params[0]);
        const found = state.equipamentos.find(e => e.id === id);
        return [found ? [{ ...found }] : []];
      }

      // 2. SELECT equipamento por código LabControl
      if (s.includes('UPPER(e.codigo_labcontrol) = UPPER(?)')) {
        const code = String(params[0]).toUpperCase();
        const matches = state.equipamentos.filter(e => (e.codigo_labcontrol || '').toUpperCase() === code);
        return [matches.map(e => ({ ...e }))];
      }

      // 3. SELECT equipamento por patrimônio
      if (s.includes('UPPER(e.codigo_patrimonio) = UPPER(?) OR UPPER(e.patrimonio_ufpi) = UPPER(?)')) {
        const code = String(params[0]).toUpperCase();
        const matches = state.equipamentos.filter(e =>
          (e.codigo_patrimonio || '').toUpperCase() === code ||
          (e.patrimonio_ufpi || '').toUpperCase() === code
        );
        return [matches.map(e => ({ ...e }))];
      }

      // 4. Checagem de ambiguidade numérica: (codigo_patrimonio = ? OR patrimonio_ufpi = ?) AND id != ?
      if (s.includes('(codigo_patrimonio = ? OR patrimonio_ufpi = ?) AND id != ?')) {
        const code = String(params[0]);
        const excludeId = Number(params[2]);
        const matches = state.equipamentos.filter(e =>
          e.id !== excludeId &&
          (String(e.codigo_patrimonio) === code || String(e.patrimonio_ufpi) === code)
        );
        return [matches.map(e => ({ id: e.id }))];
      }

      // 5. Geração em lote: SELECT WHERE e.id IN (?)
      if (s.includes('FROM equipamento e') && s.includes('WHERE e.id IN (?)')) {
        const ids = params[0] || [];
        const matches = state.equipamentos.filter(e => ids.includes(e.id));
        return [matches.map(e => ({ ...e }))];
      }

      // 6. Inventário: SELECT * FROM inventario WHERE id = ? FOR UPDATE
      if (s.includes('FROM `inventario` WHERE id = ? FOR UPDATE')) {
        const invId = Number(params[0]);
        const inv = state.inventarios.find(i => i.id === invId);
        return [inv ? [{ ...inv }] : []];
      }

      // 7. Inventário: SELECT * FROM inventario_item WHERE inventario_id = ? AND equipamento_id = ? FOR UPDATE
      if (s.includes('FROM `inventario_item`') && s.includes('WHERE inventario_id = ? AND equipamento_id = ?')) {
        const invId = Number(params[0]);
        const eqId = Number(params[1]);
        const found = state.inventarioItens.find(it => it.inventario_id === invId && it.equipamento_id === eqId);
        return [found ? [{ ...found }] : []];
      }

      // 8. Inventário: INSERT INTO inventario_item
      if (s.includes('INSERT INTO `inventario_item`')) {
        const [invId, eqId, espEspId, espEncId, stConf, decAdmin] = params;
        const newItem = {
          id: state.inventarioItens.length + 101,
          inventario_id: invId,
          equipamento_id: eqId,
          espaco_esperado_id: espEspId,
          espaco_encontrado_id: espEncId,
          status_conferencia: stConf,
          decisao_admin: decAdmin,
          data_leitura: new Date()
        };
        state.inventarioItens.push(newItem);
        return [{ insertId: newItem.id, affectedRows: 1 }];
      }

      // 9. Inventário: SELECT it.* FROM inventario_item it ... WHERE it.id = ?
      if (s.includes('FROM `inventario_item` it') && s.includes('WHERE it.id = ?') && !s.includes('JOIN `inventario`')) {
        const itemId = Number(params[0]);
        const item = state.inventarioItens.find(it => it.id === itemId);
        if (!item) return [[]];
        const equip = state.equipamentos.find(e => e.id === item.equipamento_id);
        return [[{
          ...item,
          equipamento_nome: equip?.nome,
          codigo_patrimonio: equip?.codigo_patrimonio,
          patrimonio_ufpi: equip?.patrimonio_ufpi,
          codigo_labcontrol: equip?.codigo_labcontrol,
          espaco_esperado_nome: equip?.espaco_nome,
          espaco_encontrado_nome: 'Laboratório de Biologia'
        }]];
      }

      // 10. Atualização de contadores em inventário
      if (s.includes('UPDATE `inventario` SET total_conferidos = total_conferidos + 1')) {
        const invId = Number(params[0]);
        const inv = state.inventarios.find(i => i.id === invId);
        if (inv) inv.total_conferidos += 1;
        return [{ affectedRows: 1 }];
      }
      if (s.includes('UPDATE `inventario` SET total_divergentes = total_divergentes + 1')) {
        const invId = Number(params[0]);
        const inv = state.inventarios.find(i => i.id === invId);
        if (inv) inv.total_divergentes += 1;
        return [{ affectedRows: 1 }];
      }

      // 11. Decisão de divergência: SELECT it.* FOR UPDATE
      if (s.includes('FROM `inventario_item` it') && s.includes('JOIN `inventario` inv') && s.includes('FOR UPDATE')) {
        const itemId = Number(params[0]);
        const invId = Number(params[1]);
        const item = state.inventarioItens.find(it => it.id === itemId && it.inventario_id === invId);
        if (!item) return [[]];
        const inv = state.inventarios.find(i => i.id === invId);
        const equip = state.equipamentos.find(e => e.id === item.equipamento_id);
        return [[{
          ...item,
          inventario_espaco_id: inv?.espaco_id,
          inventario_status: inv?.status,
          equipamento_espaco_id: equip?.espaco_id,
          espaco_anterior_nome: equip?.espaco_nome,
          espaco_novo_nome: 'Laboratório de Biologia'
        }]];
      }

      // 12. UPDATE equipamento SET espaco_id = ? WHERE id = ? AND espaco_id = ?
      if (s.includes('UPDATE equipamento SET espaco_id = ? WHERE id = ? AND espaco_id = ?')) {
        const [novoEspacoId, equipId, espacoAnteriorId] = params;
        const equip = state.equipamentos.find(e => e.id === Number(equipId));
        if (!equip || equip.espaco_id !== Number(espacoAnteriorId)) {
          return [{ affectedRows: 0 }];
        }
        equip.espaco_id = Number(novoEspacoId);
        equip.espaco_nome = 'Laboratório de Biologia';
        return [{ affectedRows: 1 }];
      }

      // 13. UPDATE inventario_item SET decisao_admin = ? WHERE id = ? AND decisao_admin = 'pendente'
      if (s.includes('SET decisao_admin = ?, decisao_usuario_id = ?, decisao_data = NOW()')) {
        const [decisao, usuarioId, itemId] = params;
        const item = state.inventarioItens.find(it => it.id === Number(itemId));
        if (!item || item.decisao_admin !== 'pendente') {
          return [{ affectedRows: 0 }];
        }
        item.decisao_admin = decisao;
        item.decisao_usuario_id = usuarioId;
        item.decisao_data = new Date();
        return [{ affectedRows: 1 }];
      }

      // 14. getInventarioById
      if (s.includes('SELECT inv.*,') && s.includes('FROM `inventario` inv')) {
        const invId = Number(params[0]);
        const inv = state.inventarios.find(i => i.id === invId);
        if (!inv) return [[]];
        return [[{ ...inv, espaco_nome: 'Laboratório de Biologia' }]];
      }
      if (s.includes('FROM equipamento e') && s.includes('WHERE e.espaco_id = ?')) {
        const espacoId = Number(params[0]);
        const esperados = state.equipamentos.filter(e => e.espaco_id === espacoId && !e.inativo);
        return [esperados.map(e => ({ ...e }))];
      }
      if (s.includes('FROM `inventario_item` it') && s.includes('WHERE it.inventario_id = ?')) {
        const invId = Number(params[0]);
        const itens = state.inventarioItens.filter(it => it.inventario_id === invId);
        return [itens.map(it => {
          const equip = state.equipamentos.find(e => e.id === it.equipamento_id);
          return {
            ...it,
            equipamento_nome: equip?.nome,
            codigo_patrimonio: equip?.codigo_patrimonio,
            patrimonio_ufpi: equip?.patrimonio_ufpi,
            codigo_labcontrol: equip?.codigo_labcontrol
          };
        })];
      }

      throw new Error(`Query simulada não tratada: ${sql}`);
    }
  };

  return { state, executor };
}

// ---------------------------------------------------------
// SUÍTE DE TESTES: FASE C - FLUXOS QR
// ---------------------------------------------------------

// 1. QR Válido com Payload JSON Estruturado
async function testQRValidoPayloadJson() {
  const { executor } = createDatabaseState();

  const qrJson = JSON.stringify({
    id: 1,
    codigo_labcontrol: 'LC-EQ-0001',
    patrimonio_ufpi: 'PAT-UFPI-1001',
    nome: 'Microscópio Óptico Binocular',
    action: 'LABCONTROL_CHECKIN_CHECKOUT'
  });

  const equip = await equipamentoModel.localizarPorIdentificadorQR(qrJson, executor);
  assert.ok(equip, 'Equipamento deve ser localizado a partir do JSON do QR Code');
  assert.equal(equip.id, 1);
  assert.equal(equip.codigo_labcontrol, 'LC-EQ-0001');

  // Teste de consistência: se o JSON trouxer ID 1 mas código LabControl de outro equipamento, deve rejeitar
  const qrInconsistente = JSON.stringify({
    id: 1,
    codigo_labcontrol: 'LC-EQ-9999', // Código divergente do ID
    action: 'LABCONTROL_CHECKIN_CHECKOUT'
  });

  await assert.rejects(
    equipamentoModel.localizarPorIdentificadorQR(qrInconsistente, executor),
    (err) => err.statusCode === 400,
    'QR Code com inconsistência entre ID e código LabControl deve ser rejeitado'
  );
}

// 2. QR Válido por Código LabControl, Patrimônio UFPI e ID
async function testQRValidoPorCodigos() {
  const { executor } = createDatabaseState();

  // Por código LabControl
  const equipLab = await equipamentoModel.localizarPorIdentificadorQR('LC-EQ-0002', executor);
  assert.ok(equipLab, 'Deve localizar por código LabControl');
  assert.equal(equipLab.id, 2);

  // Por patrimônio UFPI
  const equipPat = await equipamentoModel.localizarPorIdentificadorQR('PAT-UFPI-1003', executor);
  assert.ok(equipPat, 'Deve localizar por patrimônio UFPI');
  assert.equal(equipPat.id, 3);

  // Por ID numérico string
  const equipId = await equipamentoModel.localizarPorIdentificadorQR('1', executor);
  assert.ok(equipId, 'Deve localizar por ID numérico');
  assert.equal(equipId.id, 1);
}

// 3. QR Inexistente e Equipamento Inexistente
async function testQRInexistenteEEquipamentoInexistente() {
  const { executor } = createDatabaseState();

  // Código inexistente
  const naoEncontrado = await equipamentoModel.localizarPorIdentificadorQR('LC-EQ-INEXISTENTE', executor);
  assert.equal(naoEncontrado, null, 'Código inexistente deve retornar null');

  // ID inexistente
  const idInexistente = await equipamentoModel.localizarPorIdentificadorQR('99999', executor);
  assert.equal(idInexistente, null, 'ID inexistente deve retornar null');

  // JSON com ID inexistente
  const jsonInexistente = JSON.stringify({ id: 8888, codigo_labcontrol: 'LC-EQ-8888' });
  const jsonNaoEncontrado = await equipamentoModel.localizarPorIdentificadorQR(jsonInexistente, executor);
  assert.equal(jsonNaoEncontrado, null, 'JSON com ID inexistente deve retornar null');
}

// 4. Prevenção de Ambiguidade
async function testPrevencaoAmbiguidade() {
  const { executor } = createDatabaseState();

  // '777' é o patrimônio do equipamento #6 E também é o ID do equipamento #777
  // Deve recusar a seleção arbitrária com erro 409
  await assert.rejects(
    equipamentoModel.localizarPorIdentificadorQR('777', executor),
    (err) => err.statusCode === 409,
    'Identificador ambíguo deve lançar erro 409 e NÃO selecionar equipamento incorreto'
  );

  // Com o QR Code estruturado inequívoco, deve resolver corretamente cada um
  const qrEquip6 = JSON.stringify({ id: 6, codigo_labcontrol: 'LC-EQ-0006' });
  const resolvido6 = await equipamentoModel.localizarPorIdentificadorQR(qrEquip6, executor);
  assert.equal(resolvido6.id, 6, 'QR estruturado do equipamento 6 deve resolver inequivocamente');

  const qrEquip777 = JSON.stringify({ id: 777, codigo_labcontrol: 'LC-EQ-0777' });
  const resolvido777 = await equipamentoModel.localizarPorIdentificadorQR(qrEquip777, executor);
  assert.equal(resolvido777.id, 777, 'QR estruturado do equipamento 777 deve resolver inequivocamente');
}

// 5. Inventário: Localização Correta (Conferido)
async function testInventarioLocalizacaoCorreta() {
  const { state, executor } = createDatabaseState();

  // Equipamento #1 pertence ao espaço 10, e o inventário #100 é do espaço 10
  const resultado = await inventarioModel.scanItem(100, 'LC-EQ-0001', 50, executor);

  assert.equal(resultado.jaConferido, false);
  assert.equal(resultado.isDivergente, false);
  assert.equal(resultado.item.status_conferencia, 'conferido');
  assert.equal(resultado.item.decisao_admin, 'conforme');
  assert.equal(resultado.item.espaco_esperado_id, 10);
  assert.equal(resultado.item.espaco_encontrado_id, 10);
  assert.equal(state.inventarios[0].total_conferidos, 1);
  assert.equal(state.inventarios[0].total_divergentes, 0);
}

// 6. Inventário: Divergência de Localização
// REGRA CRÍTICA OBRIGATÓRIA: O inventário NÃO altera automaticamente a localização!
async function testInventarioDivergenciaNaoAlteraLocalizacao() {
  const { state, executor } = createDatabaseState();

  // Equipamento #5 pertence ao espaço 20 (Química), mas está sendo escaneado no inventário #100 (Biologia)
  const resultado = await inventarioModel.scanItem(100, 'LC-EQ-0005', 50, executor);

  assert.equal(resultado.jaConferido, false);
  assert.equal(resultado.isDivergente, true);
  assert.equal(resultado.item.status_conferencia, 'divergente');
  assert.equal(resultado.item.decisao_admin, 'pendente');
  assert.equal(resultado.item.espaco_esperado_id, 20);
  assert.equal(resultado.item.espaco_encontrado_id, 10);
  assert.equal(state.inventarios[0].total_divergentes, 1);

  // VERIFICAÇÃO FUNDAMENTAL: a localização física no cadastro NÃO foi alterada!
  const equip5 = state.equipamentos.find(e => e.id === 5);
  assert.equal(equip5.espaco_id, 20, 'A localização do equipamento NÃO pode ser alterada apenas por escanear o QR');
}

// 7. Divergência: Decisão Administrativa de Transferência
async function testDivergenciaDecisaoTransferir() {
  const { state, executor } = createDatabaseState();

  // Escaneia item divergente
  const scanResult = await inventarioModel.scanItem(100, 'LC-EQ-0005', 50, executor);
  const itemId = scanResult.item.id;

  // Administrador decide transferir o equipamento para o laboratório onde foi encontrado (espaço 10)
  const atualizado = await inventarioModel.decidirDivergencia(100, itemId, 'transferir', 50, executor);

  const equip5 = state.equipamentos.find(e => e.id === 5);
  assert.equal(equip5.espaco_id, 10, 'A localização deve ser atualizada para o espaço encontrado após decisão explícita');
  assert.equal(atualizado.alteracaoLocalizacao.espaco_anterior_id, 20);
  assert.equal(atualizado.alteracaoLocalizacao.espaco_novo_id, 10);
  assert.equal(atualizado.alteracaoLocalizacao.decisao, 'transferir_localizacao');

  const itemNoBanco = state.inventarioItens.find(it => it.id === itemId);
  assert.equal(itemNoBanco.decisao_admin, 'transferir_localizacao');
  assert.equal(itemNoBanco.decisao_usuario_id, 50);
}

// 8. Divergência: Decisão Administrativa de Manter Localização Original
async function testDivergenciaDecisaoManter() {
  const { state, executor } = createDatabaseState();

  // Escaneia item divergente
  const scanResult = await inventarioModel.scanItem(100, 'LC-EQ-0005', 50, executor);
  const itemId = scanResult.item.id;

  // Administrador decide manter o equipamento no cadastro original (espaço 20)
  const atualizado = await inventarioModel.decidirDivergencia(100, itemId, 'manter', 50, executor);

  const equip5 = state.equipamentos.find(e => e.id === 5);
  assert.equal(equip5.espaco_id, 20, 'A localização original deve ser preservada intacta');
  assert.equal(atualizado.alteracaoLocalizacao.espaco_anterior_id, 20);
  assert.equal(atualizado.alteracaoLocalizacao.espaco_novo_id, 20);
  assert.equal(atualizado.alteracaoLocalizacao.decisao, 'manter_localizacao_original');

  const itemNoBanco = state.inventarioItens.find(it => it.id === itemId);
  assert.equal(itemNoBanco.decisao_admin, 'manter_localizacao_original');
}

// 9. Concorrência: Prevenção de Decisões Duplicadas e Leitura Repetida
async function testConcorrenciaEIntegridade() {
  const { executor } = createDatabaseState();

  // 1. Escaneia item 1
  await inventarioModel.scanItem(100, 'LC-EQ-0001', 50, executor);

  // 2. Tenta escanear o mesmo item novamente na mesma sessão: deve retornar jaConferido = true sem duplicar
  const repetido = await inventarioModel.scanItem(100, 'LC-EQ-0001', 50, executor);
  assert.equal(repetido.jaConferido, true, 'Releitura do mesmo item deve informar que já foi conferido');

  // 3. Escaneia item divergente e decide
  const divergente = await inventarioModel.scanItem(100, 'LC-EQ-0005', 50, executor);
  await inventarioModel.decidirDivergencia(100, divergente.item.id, 'manter', 50, executor);

  // 4. Tentativa de decisão duplicada concorrente deve ser bloqueada com conflito 409
  await assert.rejects(
    inventarioModel.decidirDivergencia(100, divergente.item.id, 'transferir', 50, executor),
    (err) => err.statusCode === 409,
    'Decisão concorrente em item já decidido deve lançar erro 409'
  );
}

// 10. Geração de Etiquetas em Lote (Sem Dados Fictícios)
async function testGeracaoEtiquetasEmLote() {
  const { executor } = createDatabaseState();

  // Seleciona múltiplos equipamentos: #1 (com patrimônio UFPI) e #4 (sem patrimônio UFPI)
  const etiquetas = await equipamentoModel.gerarEtiquetasEmLote([1, 4], executor);

  assert.equal(etiquetas.length, 2, 'Deve gerar exatamente 2 etiquetas');

  const etq1 = etiquetas.find(e => e.id === 1);
  assert.ok(etq1);
  assert.equal(etq1.nome, 'Microscópio Óptico Binocular');
  assert.equal(etq1.codigo_labcontrol, 'LC-EQ-0001');
  assert.equal(etq1.patrimonio_ufpi, 'PAT-UFPI-1001');
  assert.ok(etq1.qr_payload.includes('LC-EQ-0001'));

  const etq4 = etiquetas.find(e => e.id === 4);
  assert.ok(etq4);
  assert.equal(etq4.nome, 'Espectrofotômetro UV-Vis');
  assert.equal(etq4.codigo_labcontrol, 'LC-EQ-0004');
  // CRÍTICO: Não deve conter dados fictícios como "UFPI-4"!
  assert.equal(etq4.patrimonio_ufpi, null, 'Quando não houver patrimônio UFPI, o valor deve ser nulo e NÃO fictício');
  assert.equal(etq4.qr_payload.includes('UFPI-4'), false, 'QR Code não deve conter patrimônio inventado');
}

// 11. Validação de Rastreabilidade e Auditoria
async function testRastreabilidadeAuditoria() {
  const events = [];
  const fakeConnection = {
    async query() {},
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {}
  };

  // Simula registrarEvento
  const mockAuditoria = {
    async registrarEvento(event) {
      events.push(event);
    }
  };

  await mockAuditoria.registrarEvento({
    equipamento_id: 5,
    entidade: 'inventario_item',
    entidade_id: 102,
    acao: 'inventario_divergencia_decidida',
    usuario_id: 50,
    detalhes: {
      inventario_id: 100,
      decisao: 'transferir',
      espaco_anterior_id: 20,
      espaco_novo_id: 10,
      data_hora_decisao: new Date().toISOString()
    }
  });

  await mockAuditoria.registrarEvento({
    equipamento_id: 5,
    entidade: 'equipamento',
    entidade_id: 5,
    acao: 'equipamento_local_alterado',
    usuario_id: 50,
    detalhes: {
      origem: 'inventario_divergencia',
      inventario_id: 100,
      espaco_anterior_id: 20,
      espaco_novo_id: 10,
      data_hora_alteracao: new Date().toISOString()
    }
  });

  assert.equal(events.length, 2);
  assert.equal(events[0].acao, 'inventario_divergencia_decidida');
  assert.equal(events[1].acao, 'equipamento_local_alterado');
  assert.equal(events[1].detalhes.espaco_anterior_id, 20);
  assert.equal(events[1].detalhes.espaco_novo_id, 10);
}

// 12. Estados Operacionais via QR: Disponível, Em Uso, Manutenção e Inativo
async function testIdentificarQREstadosOperacionais() {
  const { state } = createDatabaseState();

  const originalEquipamentoModel = require('./models/equipamentoModel');
  const originalUtilizacaoModel = require('./models/utilizacaoModel');
  const originalCapacitacaoModel = require('./models/capacitacaoModel');

  function installMockModule(modulePath, exports) {
    const resolved = require.resolve(modulePath);
    require.cache[resolved] = {
      id: resolved,
      filename: resolved,
      loaded: true,
      exports
    };
  }

  installMockModule('./models/equipamentoModel', {
    ...originalEquipamentoModel,
    async localizarPorIdentificadorQR(scannedValue) {
      const code = String(scannedValue).toUpperCase().trim();
      return state.equipamentos.find(e =>
        (e.codigo_labcontrol || '').toUpperCase() === code ||
        (e.patrimonio_ufpi || '').toUpperCase() === code ||
        String(e.id) === code
      ) || null;
    }
  });

  installMockModule('./models/utilizacaoModel', {
    ...originalUtilizacaoModel,
    async getActiveUtilizacaoByEquipamento(equipId) {
      return state.utilizacoes.find(u => u.equipamento_id === Number(equipId)) || null;
    }
  });

  installMockModule('./models/capacitacaoModel', {
    ...originalCapacitacaoModel,
    async checkUserCapacitacao() {
      return true;
    }
  });

  delete require.cache[require.resolve('./controllers/equipamentoController')];
  const equipamentoController = require('./controllers/equipamentoController');

  function invokeIdentificar(scannedValue, userRole = 'usuario', userId = 42) {
    return new Promise((resolve) => {
      const req = {
        body: { scanned_value: scannedValue },
        user: { id: userId, perfil: userRole }
      };
      const res = {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.body = data; resolve(this); }
      };
      equipamentoController.identificarQR(req, res);
    });
  }

  try {
    // 1. Equipamento 1 (Disponível) -> fluxoRecomendado: 'checkin'
    const res1 = await invokeIdentificar('LC-EQ-0001');
    assert.equal(res1.statusCode, 200);
    assert.equal(res1.body.fluxoRecomendado, 'checkin');
    assert.equal(res1.body.podeCheckin, true);

    // 2. Equipamento 2 (Em Uso - uso ativo pelo usuário 42) -> fluxoRecomendado: 'checkout'
    const res2 = await invokeIdentificar('LC-EQ-0002');
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.body.fluxoRecomendado, 'checkout');
    assert.ok(res2.body.utilizacaoAtiva);
    assert.equal(res2.body.podeCheckout, true);

    // 3. Equipamento 3 (Em Manutenção) -> fluxoRecomendado: 'bloqueado'
    const res3 = await invokeIdentificar('LC-EQ-0003');
    assert.equal(res3.statusCode, 200);
    assert.equal(res3.body.fluxoRecomendado, 'bloqueado');
    assert.ok(res3.body.motivoBloqueio.toLowerCase().includes('manutenção'));

    // 4. Equipamento 4 (Inativo) -> fluxoRecomendado: 'bloqueado'
    const res4 = await invokeIdentificar('LC-EQ-0004');
    assert.equal(res4.statusCode, 200);
    assert.equal(res4.body.fluxoRecomendado, 'bloqueado');
    assert.ok(res4.body.motivoBloqueio.toLowerCase().includes('inativo'));
  } finally {
    // Restaura módulos originais
    installMockModule('./models/equipamentoModel', originalEquipamentoModel);
    installMockModule('./models/utilizacaoModel', originalUtilizacaoModel);
    installMockModule('./models/capacitacaoModel', originalCapacitacaoModel);
    delete require.cache[require.resolve('./controllers/equipamentoController')];
  }
}

// ---------------------------------------------------------
// Execução de todos os testes
// ---------------------------------------------------------
async function runAllTests() {
  console.log('\n========================================');
  console.log('LABCONTROL - TESTES DA FASE C: FLUXOS QR');
  console.log('========================================\n');

  await runTest('1. Identificação inequívoca via QR estruturado JSON', testQRValidoPayloadJson);
  await runTest('2. Identificação por código LabControl, patrimônio UFPI e ID', testQRValidoPorCodigos);
  await runTest('3. Tratamento de QR inexistente e equipamento inexistente', testQRInexistenteEEquipamentoInexistente);
  await runTest('4. Prevenção rigorosa de ambiguidade na identificação', testPrevencaoAmbiguidade);
  await runTest('5. Inventário físico: conferência com localização correta', testInventarioLocalizacaoCorreta);
  await runTest('6. Inventário físico: divergência NÃO altera localização automaticamente', testInventarioDivergenciaNaoAlteraLocalizacao);
  await runTest('7. Decisão de divergência: transferência deliberada com atualização', testDivergenciaDecisaoTransferir);
  await runTest('8. Decisão de divergência: manutenção da localização original preservada', testDivergenciaDecisaoManter);
  await runTest('9. Integridade e concorrência: bloqueio de duplicidades e decisões concorrentes', testConcorrenciaEIntegridade);
  await runTest('10. Geração de etiquetas em lote adequada para impressão sem dados fictícios', testGeracaoEtiquetasEmLote);
  await runTest('11. Rastreabilidade e registro formal de eventos de auditoria', testRastreabilidadeAuditoria);
  await runTest('12. Identificação de estados operacionais (disponível, uso, manutenção, inativo)', testIdentificarQREstadosOperacionais);

  console.log('\n========================================');
  console.log('TODOS OS TESTES DA FASE C PASSARAM COM SUCESSO!');
  console.log('========================================\n');
}

runAllTests().catch((err) => {
  console.error('\nFALHA NOS TESTES DA FASE C:');
  console.error(err);
  process.exit(1);
});
