// Banco de dados simulado (Mock Database) para demonstração interativa sem necessidade de backend/MySQL ativo
const STORAGE_KEY = 'labcontrol_demo_db_v2';

const initialData = {
  usuarios: [
    { id: 1, nome: 'Administrador Demo', email: 'admin@labcontrol.com', perfil: 'ADMIN', matricula: 'ADM-001', status: 'ATIVO', departamento: 'Coordenação de Laboratórios' },
    { id: 2, nome: 'Prof. Carlos Santos', email: 'professor@labcontrol.com', perfil: 'PROFESSOR', matricula: 'DOC-102', status: 'ATIVO', departamento: 'Engenharia e Automação' },
    { id: 3, nome: 'Mariana Lima', email: 'aluno@labcontrol.com', perfil: 'ALUNO', matricula: 'DIS-2024-05', status: 'ATIVO', departamento: 'Ciência da Computação' }
  ],
  espacos: [
    { id: 1, nome: 'Laboratório de Informática 1', codigo: 'LAB-INF-01', capacidade: 35, localizacao: 'Bloco B - Sala 204', status: 'DISPONIVEL', descricao: 'Equipado com 35 estações de trabalho e projetor interativo.' },
    { id: 2, nome: 'Espaço Maker & Prototipagem (FabLab)', codigo: 'MAKER-01', capacidade: 20, localizacao: 'Bloco C - Térreo', status: 'DISPONIVEL', descricao: 'Impressoras 3D, cortadora a laser, bancadas de marcenaria e eletrônica.' },
    { id: 3, nome: 'Laboratório de Robótica e Automação', codigo: 'LAB-ROB-01', capacidade: 25, localizacao: 'Bloco A - Sala 102', status: 'DISPONIVEL', descricao: 'Bancadas industriais, braços robóticos e kits microcontrolados.' },
    { id: 4, nome: 'Laboratório de Química Analítica', codigo: 'LAB-QUI-01', capacidade: 20, localizacao: 'Bloco D - 1º Andar', status: 'MANUTENCAO', descricao: 'Capela de exaustão, reagentes e balanças de precisão analítica.' }
  ],
  equipamentos: [
    { id: 1, nome: 'Impressora 3D Creality K1 Speed', codigo_patrimonio: 'PAT-2024-001', patrimonio_ufpi: 'UFPI-PAT-001', codigo_labcontrol: 'LC-EQ-0001', espaco_id: 2, espaco_nome: 'Espaço Maker & Prototipagem (FabLab)', status: 'disponivel', inativo: 0, categoria: 'Fabricação Digital', marca: 'Creality', modelo: 'Creality K1 600mm/s', numero_serie: 'CR-K1-99812', localizacao_detalhada: 'Bancada 01 - Fabricação Digital' },
    { id: 2, nome: 'Cortadora e Gravadora a Laser CO2 60W', codigo_patrimonio: 'PAT-2024-002', patrimonio_ufpi: 'UFPI-PAT-002', codigo_labcontrol: 'LC-EQ-0002', espaco_id: 2, espaco_nome: 'Espaço Maker & Prototipagem (FabLab)', status: 'em_uso', inativo: 0, categoria: 'Corte e Usinagem', marca: 'LaserMaster', modelo: 'LaserMaster 4060', numero_serie: 'LM-60W-3312', localizacao_detalhada: 'Área de Corte Fechada' },
    { id: 3, nome: 'Osciloscópio Digital Tektronix 50MHz', codigo_patrimonio: 'PAT-2024-003', patrimonio_ufpi: 'UFPI-PAT-003', codigo_labcontrol: 'LC-EQ-0003', espaco_id: 3, espaco_nome: 'Laboratório de Robótica e Automação', status: 'disponivel', inativo: 0, categoria: 'Instrumentação', marca: 'Tektronix', modelo: 'TBS1052B-EDU', numero_serie: 'TEK-50-8472', localizacao_detalhada: 'Bancada de Eletrônica 02' },
    { id: 4, nome: 'Braço Robótico Dobot Magician', codigo_patrimonio: 'PAT-2024-004', patrimonio_ufpi: 'UFPI-PAT-004', codigo_labcontrol: 'LC-EQ-0004', espaco_id: 3, espaco_nome: 'Laboratório de Robótica e Automação', status: 'disponivel', inativo: 0, categoria: 'Robótica', marca: 'Dobot', modelo: 'Dobot Basic V2', numero_serie: 'DOBOT-1029', localizacao_detalhada: 'Célula de Automação A' },
    { id: 5, nome: 'Microscópio Óptico Binocular Nikon', codigo_patrimonio: 'PAT-2024-005', patrimonio_ufpi: 'UFPI-PAT-005', codigo_labcontrol: 'LC-EQ-0005', espaco_id: 4, espaco_nome: 'Laboratório de Química Analítica', status: 'manutencao', inativo: 0, categoria: 'Óptica', marca: 'Nikon', modelo: 'Eclipse E100', numero_serie: 'NK-88219', localizacao_detalhada: 'Bancada Central de Óptica' },
    { id: 6, nome: 'Estação de Solda Digital AFR 936', codigo_patrimonio: 'PAT-2024-006', patrimonio_ufpi: 'UFPI-PAT-006', codigo_labcontrol: 'LC-EQ-0006', espaco_id: 2, espaco_nome: 'Espaço Maker & Prototipagem (FabLab)', status: 'disponivel', inativo: 0, categoria: 'Eletrônica', marca: 'AFR', modelo: 'AFR 936 ESD', numero_serie: 'AFR-7721', localizacao_detalhada: 'Bancada de Montagem Rápida' }
  ],
  reservas: [
    {
      id: 1,
      usuario_id: 2,
      usuario_nome: 'Prof. Carlos Santos',
      espaco_id: 2,
      espaco_nome: 'Espaço Maker & Prototipagem (FabLab)',
      equipamento_id: 2,
      equipamento_nome: 'Cortadora e Gravadora a Laser CO2 60W',
      data_inicio: new Date(Date.now() - 3600000).toISOString(),
      data_fim: new Date(Date.now() + 7200000).toISOString(),
      finalidade: 'Aula prática de Prototipagem Rápida',
      status: 'em_andamento'
    },
    {
      id: 2,
      usuario_id: 3,
      usuario_nome: 'Mariana Lima',
      espaco_id: 3,
      espaco_nome: 'Laboratório de Robótica e Automação',
      equipamento_id: 4,
      equipamento_nome: 'Braço Robótico Dobot Magician',
      data_inicio: new Date(Date.now() + 86400000).toISOString(),
      data_fim: new Date(Date.now() + 93600000).toISOString(),
      finalidade: 'Pesquisa TCC - Controle Cinemático',
      status: 'confirmada'
    },
    {
      id: 3,
      usuario_id: 1,
      usuario_nome: 'Administrador Demo',
      espaco_id: 1,
      espaco_nome: 'Laboratório de Informática 1',
      equipamento_id: null,
      equipamento_nome: null,
      data_inicio: new Date(Date.now() + 172800000).toISOString(),
      data_fim: new Date(Date.now() + 180000000).toISOString(),
      finalidade: 'Treinamento Institucional de Docentes',
      status: 'pendente'
    }
  ],
  utilizacoes: [
    {
      id: 1,
      usuario_id: 2,
      usuario_nome: 'Prof. Carlos Santos',
      equipamento_id: 2,
      equipamento_nome: 'Cortadora e Gravadora a Laser CO2 60W',
      data_inicio: new Date(Date.now() - 1800000).toISOString(),
      data_fim: null,
      status: 'EM_USO',
      observacoes: 'Check-in realizado via QR Code'
    }
  ],
  ocorrencias: [
    {
      id: 1,
      equipamento_id: 5,
      equipamento_nome: 'Microscópio Óptico Binocular Nikon',
      espaco_id: 4,
      espaco_nome: 'Laboratório de Química Analítica',
      usuario_nome: 'Mariana Lima',
      tipo: 'DEFEITO',
      prioridade: 'ALTA',
      descricao: 'Lente objetiva de 40x apresenta folga e desalinhamento ótico.',
      status: 'EM_ANALISE',
      data_criacao: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: 2,
      equipamento_id: 1,
      equipamento_nome: 'Impressora 3D Creality K1 Speed',
      espaco_id: 2,
      espaco_nome: 'Espaço Maker & Prototipagem (FabLab)',
      usuario_nome: 'Prof. Carlos Santos',
      tipo: 'AVISO',
      prioridade: 'BAIXA',
      descricao: 'Bico extrusor precisará de troca preventiva nos próximos dias.',
      status: 'ABERTA',
      data_criacao: new Date(Date.now() - 172800000).toISOString()
    }
  ],
  manutencoes: [
    {
      id: 1,
      equipamento_id: 5,
      equipamento_nome: 'Microscópio Óptico Binocular Nikon',
      tipo: 'CORRETIVA',
      descricao: 'Realinhamento e calibração das lentes com assistência técnica autorizada',
      data_agendamento: new Date(Date.now() + 86400000).toISOString(),
      responsavel: 'Óptica Precision Lab',
      custo: 350.00,
      status: 'AGENDADA'
    },
    {
      id: 2,
      equipamento_id: 2,
      equipamento_nome: 'Cortadora e Gravadora a Laser CO2 60W',
      tipo: 'PREVENTIVA',
      descricao: 'Limpeza dos espelhos ópticos e verificação do chiller de resfriamento',
      data_agendamento: new Date(Date.now() - 604800000).toISOString(),
      data_conclusao: new Date(Date.now() - 518400000).toISOString(),
      responsavel: 'Técnico Especialista Interno',
      custo: 80.00,
      status: 'CONCLUIDA'
    }
  ],
  consumiveis: [
    {
      id: 1,
      nome: 'Filamento 3D PLA Preto 1.75mm (1kg)',
      categoria: 'Impressão 3D',
      espaco_id: 2,
      espaco_nome: 'Espaço Maker & Prototipagem (FabLab)',
      quantidade: 2,
      quantidade_minima: 5,
      unidade: 'kg',
      estoque_critico: true
    },
    {
      id: 2,
      nome: 'Álcool Isopropílico 99.8% (1L)',
      categoria: 'Limpeza e Químicos',
      espaco_id: 2,
      espaco_nome: 'Espaço Maker & Prototipagem (FabLab)',
      quantidade: 1,
      quantidade_minima: 4,
      unidade: 'L',
      estoque_critico: true
    },
    {
      id: 3,
      nome: 'Placa MDF Cru 3mm 60x40cm',
      categoria: 'Corte a Laser',
      espaco_id: 2,
      espaco_nome: 'Espaço Maker & Prototipagem (FabLab)',
      quantidade: 45,
      quantidade_minima: 15,
      unidade: 'un',
      estoque_critico: false
    },
    {
      id: 4,
      nome: 'Resistor 220 Ohms 1/4W (Pacote 100un)',
      categoria: 'Componentes Eletrônicos',
      espaco_id: 3,
      espaco_nome: 'Laboratório de Robótica e Automação',
      quantidade: 20,
      quantidade_minima: 5,
      unidade: 'pct',
      estoque_critico: false
    }
  ],
  capacitacoes: [
    {
      id: 1,
      titulo: 'Segurança Operacional e Boas Práticas em FabLab',
      espaco_id: 2,
      espaco_nome: 'Espaço Maker & Prototipagem (FabLab)',
      instrutor: 'Prof. Carlos Santos',
      carga_horaria: 4,
      data_realizacao: new Date(Date.now() + 259200000).toISOString(),
      vagas: 15,
      inscritos_count: 9,
      status: 'ABERTA',
      descricao: 'Treinamento obrigatório para utilização autônoma de máquinas do laboratório.'
    },
    {
      id: 2,
      titulo: 'Fatiamento e Impressão 3D Avançada com Creality K1',
      espaco_id: 2,
      espaco_nome: 'Espaço Maker & Prototipagem (FabLab)',
      instrutor: 'Técnico Especialista',
      carga_horaria: 6,
      data_realizacao: new Date(Date.now() + 604800000).toISOString(),
      vagas: 12,
      inscritos_count: 12,
      status: 'LOTADA',
      descricao: 'Configurações de suportes, preenchimento e materiais técnicos como PETG e ABS.'
    }
  ]
};

function getStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
      return JSON.parse(JSON.stringify(initialData));
    }
    return JSON.parse(raw);
  } catch (e) {
    return initialData;
  }
}

function saveStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Falha ao salvar mock storage:', e);
  }
}

export function handleMockRequest(method, url, data) {
  const db = getStorage();
  const cleanUrl = url.split('?')[0];

  // Helper para responder simulando Axios
  const ok = (responseData) => ({ data: responseData, status: 200, statusText: 'OK' });

  // 1. AUTENTICAÇÃO
  if (cleanUrl === '/auth/login') {
    const email = (data?.email || '').toLowerCase();
    let perfil = 'ADMIN';
    let nome = 'Administrador Demo';
    if (email.includes('aluno')) {
      perfil = 'ALUNO';
      nome = 'Mariana Lima';
    } else if (email.includes('prof')) {
      perfil = 'PROFESSOR';
      nome = 'Prof. Carlos Santos';
    }

    const usuario = {
      id: perfil === 'ADMIN' ? 1 : perfil === 'PROFESSOR' ? 2 : 3,
      nome,
      email: data?.email || 'admin@labcontrol.com',
      perfil,
      status: 'ATIVO',
      matricula: 'DEMO-' + Math.floor(1000 + Math.random() * 9000)
    };
    return ok({
      token: 'demo-jwt-token-' + Date.now(),
      usuario
    });
  }

  if (cleanUrl === '/auth/me') {
    const storedUser = localStorage.getItem('labcontrol_user');
    const u = storedUser ? JSON.parse(storedUser) : db.usuarios[0];
    return ok(u);
  }

  // 2. DASHBOARD
  if (cleanUrl === '/dashboard/metricas') {
    const espTotal = db.espacos.length;
    const eqTotal = db.equipamentos.length;
    const eqDisp = db.equipamentos.filter(e => e.status === 'DISPONIVEL').length;
    const eqUso = db.equipamentos.filter(e => e.status === 'EM_USO').length;
    const eqMan = db.equipamentos.filter(e => e.status === 'MANUTENCAO').length;
    const resAtivas = db.reservas.filter(r => (r.status || '').toLowerCase() !== 'cancelada').length;
    const ocAbertas = db.ocorrencias.filter(o => o.status !== 'RESOLVIDA').length;
    const manAtivas = db.manutencoes.filter(m => m.status !== 'CONCLUIDA').length;
    const criticos = db.consumiveis.filter(c => c.estoque_critico);

    return ok({
      espacos: { total: espTotal },
      equipamentos: {
        total: eqTotal,
        disponiveis: eqDisp,
        em_uso: eqUso,
        manutencao: eqMan
      },
      reservas: { ativas: resAtivas },
      ocorrencias: { abertas: ocAbertas },
      manutencoes: { em_andamento: manAtivas },
      consumiveis: {
        total_criticos: criticos.length,
        itens_criticos: criticos
      }
    });
  }

  // 3. ESPAÇOS
  if (cleanUrl === '/espacos') {
    if (method.toUpperCase() === 'POST') {
      const novo = { id: Date.now(), status: 'DISPONIVEL', ...data };
      db.espacos.push(novo);
      saveStorage(db);
      return ok(novo);
    }
    return ok(db.espacos);
  }
  if (cleanUrl.startsWith('/espacos/')) {
    const id = Number(cleanUrl.split('/')[2]);
    if (method.toUpperCase() === 'PUT') {
      const idx = db.espacos.findIndex(e => e.id === id);
      if (idx !== -1) {
        db.espacos[idx] = { ...db.espacos[idx], ...data };
        saveStorage(db);
        return ok(db.espacos[idx]);
      }
    }
    if (method.toUpperCase() === 'DELETE') {
      db.espacos = db.espacos.filter(e => e.id !== id);
      saveStorage(db);
      return ok({ message: 'Espaço removido com sucesso' });
    }

    if (cleanUrl.match(/\/espacos\/\d+\/detalhes/)) {
      const esp = db.espacos.find(e => e.id === id) || db.espacos[0];
      const equipamentos = db.equipamentos.filter(e => e.espaco_id === id && !e.inativo);
      const reservas = db.reservas.filter(r => r.espaco_id === id);
      const utilizacoes = db.utilizacoes.filter(u => equipamentos.some(eq => eq.id === u.equipamento_id) && u.status === 'EM_USO');
      const reservaAtual = reservas.find(r => r.status === 'em_andamento') || null;
      const inventarios = (db.inventarios || []).filter(inv => inv.espaco_id === id);
      return ok({
        espaco: esp,
        equipamentos,
        reservas,
        utilizacaoAtual: {
          reservaEmAndamento: reservaAtual,
          equipamentosEmUso: utilizacoes
        },
        inventarios
      });
    }

    if (cleanUrl.match(/\/espacos\/\d+\/monitor/)) {
      const esp = db.espacos.find(e => e.id === id) || db.espacos[0];
      const equipamentos = db.equipamentos.filter(e => e.espaco_id === id && !e.inativo);
      const reservas = db.reservas.filter(r => r.espaco_id === id);
      const reservaAtual = reservas.find(r => r.status === 'em_andamento') || null;
      const proximas = reservas.filter(r => r.status === 'confirmada').slice(0, 4);
      const emUso = db.utilizacoes.filter(u => equipamentos.some(eq => eq.id === u.equipamento_id) && u.status === 'EM_USO');

      return ok({
        espaco: {
          id: esp.id,
          nome: esp.nome,
          codigo: esp.codigo,
          capacidade: esp.capacidade,
          localizacao: esp.localizacao,
          status: esp.status,
          responsavel: esp.responsavel || 'Prof. Responsável'
        },
        ocupacaoAtual: {
          ocupado: !!reservaAtual || emUso.length > 0,
          reserva: reservaAtual,
          equipamentosEmUso: emUso
        },
        proximasReservas: proximas,
        estatisticasEquipamentos: {
          total: equipamentos.length,
          disponiveis: equipamentos.filter(e => e.status === 'disponivel').length,
          em_uso: equipamentos.filter(e => e.status === 'em_uso').length,
          manutencao: equipamentos.filter(e => e.status === 'manutencao').length
        },
        timestampAtualizacao: new Date().toISOString()
      });
    }

    const item = db.espacos.find(e => e.id === id);
    return ok(item || db.espacos[0]);
  }

  // 4. EQUIPAMENTOS
  if (cleanUrl === '/equipamentos') {
    if (method.toUpperCase() === 'POST') {
      const esp = db.espacos.find(s => s.id === Number(data.espaco_id));
      const randSeq = Math.floor(1000 + Math.random() * 9000);
      const novo = {
        id: Date.now(),
        codigo_patrimonio: data.codigo_patrimonio || data.patrimonio_ufpi || `PAT-${randSeq}`,
        patrimonio_ufpi: data.patrimonio_ufpi || data.codigo_patrimonio || `UFPI-${randSeq}`,
        codigo_labcontrol: data.codigo_labcontrol || `LC-EQ-${randSeq}`,
        status: data.status || 'disponivel',
        inativo: 0,
        espaco_nome: esp ? esp.nome : 'Laboratório Geral',
        ...data
      };
      db.equipamentos.push(novo);
      saveStorage(db);
      return ok(novo);
    }
    return ok(db.equipamentos);
  }
  if (cleanUrl.match(/\/equipamentos\/\d+\/inativar/)) {
    const id = Number(cleanUrl.split('/')[2]);
    const idx = db.equipamentos.findIndex(e => e.id === id);
    if (idx !== -1) {
      db.equipamentos[idx] = {
        ...db.equipamentos[idx],
        status: 'inativo',
        inativo: 1,
        inativo_em: new Date().toISOString(),
        inativo_por_usuario_nome: 'Administrador Demo',
        motivo_inativacao: data?.motivo || 'Inativação administrativa'
      };
      saveStorage(db);
      return ok({ message: 'Equipamento inativado com sucesso', equipamento: db.equipamentos[idx] });
    }
  }
  if (cleanUrl.match(/\/equipamentos\/\d+\/reativar/)) {
    const id = Number(cleanUrl.split('/')[2]);
    const idx = db.equipamentos.findIndex(e => e.id === id);
    if (idx !== -1) {
      db.equipamentos[idx] = {
        ...db.equipamentos[idx],
        status: 'disponivel',
        inativo: 0,
        inativo_em: null,
        motivo_inativacao: null
      };
      saveStorage(db);
      return ok({ message: 'Equipamento reativado com sucesso', equipamento: db.equipamentos[idx] });
    }
  }
  if (cleanUrl.match(/\/equipamentos\/\d+\/historico/)) {
    const id = Number(cleanUrl.split('/')[2]);
    const equip = db.equipamentos.find(e => e.id === id) || db.equipamentos[0];
    const utilizacoes = db.utilizacoes.filter(u => u.equipamento_id === id);
    const ocorrencias = db.ocorrencias.filter(o => o.equipamento_id === id);
    const manutencoes = db.manutencoes.filter(m => m.equipamento_id === id);
    return ok({ equipamento: equip, utilizacoes, ocorrencias, manutencoes });
  }
  if (cleanUrl.startsWith('/equipamentos/')) {
    const id = Number(cleanUrl.split('/')[2]);
    if (method.toUpperCase() === 'PUT') {
      const idx = db.equipamentos.findIndex(e => e.id === id);
      if (idx !== -1) {
        db.equipamentos[idx] = { ...db.equipamentos[idx], ...data };
        saveStorage(db);
        return ok(db.equipamentos[idx]);
      }
    }
    if (method.toUpperCase() === 'DELETE') {
      const hasHistory = db.utilizacoes.some(u => u.equipamento_id === id) ||
                         db.ocorrencias.some(o => o.equipamento_id === id) ||
                         db.manutencoes.some(m => m.equipamento_id === id);
      if (hasHistory) {
        const idx = db.equipamentos.findIndex(e => e.id === id);
        if (idx !== -1) {
          db.equipamentos[idx].status = 'inativo';
          db.equipamentos[idx].inativo = 1;
          db.equipamentos[idx].inativo_em = new Date().toISOString();
          db.equipamentos[idx].motivo_inativacao = 'Inativação automática por possuir registros históricos de uso.';
          saveStorage(db);
          return ok({ inativado: true, message: 'Equipamento possui histórico e foi inativado para preservar os dados.' });
        }
      }
      db.equipamentos = db.equipamentos.filter(e => e.id !== id);
      saveStorage(db);
      return ok({ inativado: false, message: 'Equipamento sem histórico removido com sucesso' });
    }
    const equip = db.equipamentos.find(e => e.id === id);
    return ok(equip || db.equipamentos[0]);
  }

  // 5. RESERVAS
  if (cleanUrl === '/reservas') {
    if (method.toUpperCase() === 'POST') {
      const esp = db.espacos.find(s => s.id === Number(data.espaco_id));
      const eq = data.equipamento_id ? db.equipamentos.find(e => e.id === Number(data.equipamento_id)) : null;
      const storedUser = localStorage.getItem('labcontrol_user');
      const u = storedUser ? JSON.parse(storedUser) : db.usuarios[0];

      const nova = {
        id: Date.now(),
        usuario_id: u.id,
        usuario_nome: u.nome,
        espaco_id: Number(data.espaco_id) || (esp ? esp.id : null),
        espaco_nome: esp ? esp.nome : 'Espaço Reservado',
        equipamento_id: data.equipamento_id ? Number(data.equipamento_id) : null,
        equipamento_nome: eq ? eq.nome : null,
        data_inicio: data.data_inicio,
        data_fim: data.data_fim,
        finalidade: data.finalidade || 'Uso acadêmico',
        status: 'confirmada'
      };
      db.reservas.unshift(nova);
      saveStorage(db);
      return ok(nova);
    }
    return ok(db.reservas);
  }

  // Cancelar reserva explicitamente: /reservas/:id/cancelar
  if (cleanUrl.match(/\/reservas\/\d+\/cancelar/)) {
    const id = Number(cleanUrl.split('/')[2]);
    const idx = db.reservas.findIndex(r => Number(r.id) === id);
    if (idx !== -1) {
      db.reservas[idx].status = 'cancelada';
      saveStorage(db);
      return ok({ message: 'Reserva cancelada com sucesso', reserva: db.reservas[idx] });
    }
    return { data: { error: 'Reserva não encontrada' }, status: 404, statusText: 'Not Found' };
  }

  // Atualização ou remoção genérica de reserva: /reservas/:id
  if (cleanUrl.match(/\/reservas\/\d+/)) {
    const id = Number(cleanUrl.split('/')[2]);
    const idx = db.reservas.findIndex(r => Number(r.id) === id);
    if (idx !== -1) {
      if (method.toUpperCase() === 'DELETE') {
        db.reservas[idx].status = 'cancelada';
        saveStorage(db);
        return ok({ message: 'Reserva cancelada com sucesso' });
      }
      if (method.toUpperCase() === 'PUT' || method.toUpperCase() === 'PATCH') {
        db.reservas[idx] = { ...db.reservas[idx], ...(data || {}) };
        saveStorage(db);
        return ok(db.reservas[idx]);
      }
    }
    return ok({ message: 'Reserva atualizada' });
  }

  // 6. UTILIZAÇÕES (CHECK-IN / CHECK-OUT)
  if (cleanUrl === '/utilizacoes/ativas') {
    return ok(db.utilizacoes.filter(u => u.status === 'EM_USO'));
  }
  if (cleanUrl === '/utilizacoes/checkin') {
    const eq = db.equipamentos.find(e => e.id === Number(data.equipamento_id));
    const storedUser = localStorage.getItem('labcontrol_user');
    const u = storedUser ? JSON.parse(storedUser) : db.usuarios[0];
    const nova = {
      id: Date.now(),
      usuario_id: u.id,
      usuario_nome: u.nome,
      equipamento_id: Number(data.equipamento_id),
      equipamento_nome: eq ? eq.nome : 'Equipamento',
      data_inicio: new Date().toISOString(),
      data_fim: null,
      status: 'EM_USO',
      observacoes: data.observacoes || 'Check-in realizado via QR Code'
    };
    db.utilizacoes.unshift(nova);
    if (eq) eq.status = 'EM_USO';
    saveStorage(db);
    return ok(nova);
  }
  if (cleanUrl === '/utilizacoes/checkout') {
    const ut = db.utilizacoes.find(u => u.id === Number(data.utilizacao_id) || u.equipamento_id === Number(data.equipamento_id));
    if (ut) {
      ut.data_fim = new Date().toISOString();
      ut.status = 'CONCLUIDA';
      ut.condicao_devolucao = data.condicao_devolucao;
      ut.foto_evidencia = data.foto_evidencia || null;
      ut.foto_metadata = data.foto_metadata || null;
      ut.houve_avaria = data.houve_avaria ? 1 : 0;
      ut.relato_avaria = data.relato_avaria || null;

      const eq = db.equipamentos.find(e => e.id === ut.equipamento_id);
      if (data.houve_avaria) {
        if (eq) eq.status = 'manutencao';
        // Auto-create occurrence in mock
        const storedUser = localStorage.getItem('labcontrol_user');
        const u = storedUser ? JSON.parse(storedUser) : db.usuarios[0];
        db.ocorrencias.unshift({
          id: Date.now(),
          equipamento_id: ut.equipamento_id,
          equipamento_nome: eq ? eq.nome : null,
          usuario_nome: u.nome,
          titulo: `Avaria detectada no Check-out #${ut.equipamento_id}`,
          descricao: data.relato_avaria || `Devolução em condição: ${data.condicao_devolucao}`,
          gravidade: 'alta',
          prioridade: 'ALTA',
          tipo: 'DEFEITO',
          status: 'ABERTA',
          foto_evidencia: data.foto_evidencia || null,
          foto_metadata: data.foto_metadata || null,
          data_criacao: new Date().toISOString()
        });
      } else {
        if (eq) eq.status = 'disponivel';
      }
      saveStorage(db);
      return ok({ message: 'Check-out finalizado', utilizacao: ut, avaria_registrada: !!data.houve_avaria });
    }
    return ok({ message: 'Check-out finalizado' });
  }

  // 7. OCORRÊNCIAS
  if (cleanUrl === '/ocorrencias') {
    if (method.toUpperCase() === 'POST') {
      const eq = data.equipamento_id ? db.equipamentos.find(e => e.id === Number(data.equipamento_id)) : null;
      const esp = data.espaco_id ? db.espacos.find(s => s.id === Number(data.espaco_id)) : null;
      const storedUser = localStorage.getItem('labcontrol_user');
      const u = storedUser ? JSON.parse(storedUser) : db.usuarios[0];

      const nova = {
        id: Date.now(),
        equipamento_id: data.equipamento_id || null,
        equipamento_nome: eq ? eq.nome : null,
        espaco_id: data.espaco_id || null,
        espaco_nome: esp ? esp.nome : null,
        usuario_nome: u.nome,
        titulo: data.titulo || 'Ocorrência Operacional',
        tipo: data.tipo || 'DEFEITO',
        prioridade: data.prioridade || 'MEDIA',
        gravidade: data.gravidade || 'media',
        descricao: data.descricao || '',
        foto_evidencia: data.foto_evidencia || null,
        foto_metadata: data.foto_metadata || null,
        status: 'ABERTA',
        data_criacao: new Date().toISOString(),
        data_registro: new Date().toISOString()
      };
      db.ocorrencias.unshift(nova);
      saveStorage(db);
      return ok(nova);
    }
    return ok(db.ocorrencias);
  }
  if (cleanUrl.match(/\/ocorrencias\/\d+/)) {
    const id = Number(cleanUrl.split('/')[2]);
    const idx = db.ocorrencias.findIndex(o => o.id === id);
    if (idx !== -1 && (method.toUpperCase() === 'PUT' || method.toUpperCase() === 'PATCH')) {
      db.ocorrencias[idx] = { ...db.ocorrencias[idx], ...data };
      saveStorage(db);
      return ok(db.ocorrencias[idx]);
    }
  }

  // 8. MANUTENÇÕES
  if (cleanUrl === '/manutencoes') {
    if (method.toUpperCase() === 'POST') {
      const eq = db.equipamentos.find(e => e.id === Number(data.equipamento_id));
      const nova = {
        id: Date.now(),
        equipamento_id: Number(data.equipamento_id),
        equipamento_nome: eq ? eq.nome : 'Equipamento',
        tipo: data.tipo || 'PREVENTIVA',
        descricao: data.descricao || '',
        data_agendamento: data.data_agendamento || new Date().toISOString(),
        responsavel: data.responsavel || 'Técnico Responsável',
        custo: Number(data.custo || 0),
        status: 'AGENDADA'
      };
      if (eq) eq.status = 'MANUTENCAO';
      db.manutencoes.unshift(nova);
      saveStorage(db);
      return ok(nova);
    }
    return ok(db.manutencoes);
  }
  if (cleanUrl.match(/\/manutencoes\/\d+/)) {
    const id = Number(cleanUrl.split('/')[2]);
    const idx = db.manutencoes.findIndex(m => m.id === id);
    if (idx !== -1 && (method.toUpperCase() === 'PUT' || method.toUpperCase() === 'PATCH')) {
      db.manutencoes[idx] = { ...db.manutencoes[idx], ...data };
      if (data.status === 'CONCLUIDA') {
        const eq = db.equipamentos.find(e => e.id === db.manutencoes[idx].equipamento_id);
        if (eq) eq.status = 'DISPONIVEL';
      }
      saveStorage(db);
      return ok(db.manutencoes[idx]);
    }
  }

  // 9. CONSUMÍVEIS
  if (cleanUrl === '/consumiveis') {
    if (method.toUpperCase() === 'POST') {
      const esp = db.espacos.find(s => s.id === Number(data.espaco_id));
      const novo = {
        id: Date.now(),
        nome: data.nome,
        categoria: data.categoria || 'Geral',
        espaco_id: data.espaco_id,
        espaco_nome: esp ? esp.nome : '',
        quantidade: Number(data.quantidade || 0),
        quantidade_minima: Number(data.quantidade_minima || 5),
        unidade: data.unidade || 'un',
        estoque_critico: Number(data.quantidade || 0) <= Number(data.quantidade_minima || 5)
      };
      db.consumiveis.push(novo);
      saveStorage(db);
      return ok(novo);
    }
    return ok(db.consumiveis);
  }
  if (cleanUrl.match(/\/consumiveis\/\d+\/movimentar/)) {
    const id = Number(cleanUrl.split('/')[2]);
    const item = db.consumiveis.find(c => c.id === id);
    if (item) {
      const qtd = Number(data.quantidade || 1);
      if (data.tipo === 'ENTRADA') item.quantidade += qtd;
      else if (data.tipo === 'SAIDA') item.quantidade = Math.max(0, item.quantidade - qtd);
      item.estoque_critico = item.quantidade <= item.quantidade_minima;
      saveStorage(db);
      return ok(item);
    }
  }

  // 10. CAPACITAÇÕES
  if (cleanUrl === '/capacitacoes') {
    if (method.toUpperCase() === 'POST') {
      const esp = db.espacos.find(s => s.id === Number(data.espaco_id));
      const nova = {
        id: Date.now(),
        titulo: data.titulo,
        espaco_id: data.espaco_id,
        espaco_nome: esp ? esp.nome : '',
        instrutor: data.instrutor,
        carga_horaria: Number(data.carga_horaria || 4),
        data_realizacao: data.data_realizacao,
        vagas: Number(data.vagas || 15),
        inscritos_count: 1,
        status: 'ABERTA',
        descricao: data.descricao || ''
      };
      db.capacitacoes.push(nova);
      saveStorage(db);
      return ok(nova);
    }
    return ok(db.capacitacoes);
  }
  if (cleanUrl.match(/\/capacitacoes\/\d+\/inscrever/)) {
    const id = Number(cleanUrl.split('/')[2]);
    const item = db.capacitacoes.find(c => c.id === id);
    if (item && item.inscritos_count < item.vagas) {
      item.inscritos_count += 1;
      if (item.inscritos_count >= item.vagas) item.status = 'LOTADA';
      saveStorage(db);
      return ok(item);
    }
    return ok(item || { message: 'Inscrição registrada' });
  }

  // 11. USUÁRIOS
  if (cleanUrl === '/usuarios') {
    if (method.toUpperCase() === 'POST') {
      const novo = {
        id: Date.now(),
        status: 'ATIVO',
        matricula: `USR-${Date.now().toString().slice(-4)}`,
        ...data
      };
      db.usuarios.push(novo);
      saveStorage(db);
      return ok(novo);
    }
    return ok(db.usuarios);
  }
  if (cleanUrl.startsWith('/usuarios/')) {
    const id = Number(cleanUrl.split('/')[2]);
    if (method.toUpperCase() === 'PUT') {
      const idx = db.usuarios.findIndex(u => u.id === id);
      if (idx !== -1) {
        db.usuarios[idx] = { ...db.usuarios[idx], ...data };
        saveStorage(db);
        return ok(db.usuarios[idx]);
      }
    }
    return ok({ message: 'Usuário atualizado' });
  }

  // 12. INVENTÁRIOS POR QR
  if (cleanUrl === '/inventarios') {
    db.inventarios = db.inventarios || [];
    db.inventario_itens = db.inventario_itens || [];
    if (method.toUpperCase() === 'POST') {
      const esp = db.espacos.find(s => s.id === Number(data.espaco_id));
      const storedUser = localStorage.getItem('labcontrol_user');
      const u = storedUser ? JSON.parse(storedUser) : db.usuarios[0];
      const esperados = db.equipamentos.filter(e => Number(e.espaco_id) === Number(data.espaco_id) && !e.inativo);

      const novo = {
        id: Date.now(),
        espaco_id: Number(data.espaco_id),
        espaco_nome: esp ? esp.nome : 'Laboratório',
        usuario_id: u.id,
        usuario_nome: u.nome,
        status: 'em_andamento',
        data_inicio: new Date().toISOString(),
        total_esperados: esperados.length,
        total_conferidos: 0,
        total_divergentes: 0,
        total_nao_localizados: 0,
        observacoes: data.observacoes || ''
      };
      db.inventarios.unshift(novo);
      saveStorage(db);
      return ok(novo);
    }
    return ok(db.inventarios);
  }

  if (cleanUrl.match(/\/inventarios\/\d+\/scan/)) {
    const invId = Number(cleanUrl.split('/')[2]);
    const inv = (db.inventarios || []).find(i => i.id === invId);
    if (!inv) return { data: { error: 'Inventário não encontrado' }, status: 404 };

    const term = String(data.scanned_value).trim();
    const equip = db.equipamentos.find(e => 
      String(e.id) === term ||
      (e.codigo_patrimonio && e.codigo_patrimonio.toUpperCase() === term.toUpperCase()) ||
      (e.patrimonio_ufpi && e.patrimonio_ufpi.toUpperCase() === term.toUpperCase()) ||
      (e.codigo_labcontrol && e.codigo_labcontrol.toUpperCase() === term.toUpperCase())
    );

    if (!equip) {
      return { data: { error: `Equipamento "${term}" não foi encontrado no cadastro.` }, status: 400 };
    }

    db.inventario_itens = db.inventario_itens || [];
    const jaLido = db.inventario_itens.find(it => it.inventario_id === invId && it.equipamento_id === equip.id);
    if (jaLido) {
      return ok({ jaConferido: true, item: jaLido, equipamento: equip, message: `Equipamento "${equip.nome}" já havia sido registrado nesta sessão.` });
    }

    const isMatch = Number(equip.espaco_id) === Number(inv.espaco_id);
    const espEsperado = db.espacos.find(s => s.id === equip.espaco_id);
    const espEncontrado = db.espacos.find(s => s.id === inv.espaco_id);

    const novoItem = {
      id: Date.now(),
      inventario_id: invId,
      equipamento_id: equip.id,
      equipamento_nome: equip.nome,
      codigo_patrimonio: equip.codigo_patrimonio,
      patrimonio_ufpi: equip.patrimonio_ufpi,
      codigo_labcontrol: equip.codigo_labcontrol,
      espaco_esperado_id: equip.espaco_id,
      espaco_esperado_nome: espEsperado ? espEsperado.nome : 'Outro Espaço',
      espaco_encontrado_id: inv.espaco_id,
      espaco_encontrado_nome: espEncontrado ? espEncontrado.nome : 'Espaço Atual',
      status_conferencia: isMatch ? 'conferido' : 'divergente',
      decisao_admin: isMatch ? 'conforme' : 'pendente',
      data_leitura: new Date().toISOString()
    };

    db.inventario_itens.unshift(novoItem);
    if (isMatch) inv.total_conferidos += 1;
    else inv.total_divergentes += 1;
    saveStorage(db);

    return ok({
      jaConferido: false,
      item: novoItem,
      equipamento: equip,
      isDivergente: !isMatch,
      message: isMatch
        ? `Equipamento "${equip.nome}" conferido com sucesso!`
        : `Divergência detectada! Pertence ao laboratório "${novoItem.espaco_esperado_nome}".`
    });
  }

  if (cleanUrl.match(/\/inventarios\/\d+\/decidir-divergencia/)) {
    const invId = Number(cleanUrl.split('/')[2]);
    const item = (db.inventario_itens || []).find(it => it.id === Number(data.item_id));
    if (item) {
      if (data.acao === 'transferir') {
        item.decisao_admin = 'transferir_localizacao';
        const eq = db.equipamentos.find(e => e.id === item.equipamento_id);
        if (eq) {
          eq.espaco_id = item.espaco_encontrado_id;
          const esp = db.espacos.find(s => s.id === eq.espaco_id);
          if (esp) eq.espaco_nome = esp.nome;
        }
      } else {
        item.decisao_admin = 'manter_localizacao_original';
      }
      const storedUser = localStorage.getItem('labcontrol_user');
      const u = storedUser ? JSON.parse(storedUser) : db.usuarios[0];
      item.decisao_usuario_nome = u.nome;
      item.decisao_data = new Date().toISOString();
      saveStorage(db);
    }
    const inv = db.inventarios.find(i => i.id === invId);
    return ok({ message: 'Decisão registrada', inventario: inv });
  }

  if (cleanUrl.match(/\/inventarios\/\d+\/finalizar/)) {
    const invId = Number(cleanUrl.split('/')[2]);
    const inv = (db.inventarios || []).find(i => i.id === invId);
    if (inv) {
      inv.status = 'concluido';
      inv.data_fim = new Date().toISOString();
      const esperados = db.equipamentos.filter(e => Number(e.espaco_id) === Number(inv.espaco_id) && !e.inativo);
      const lidosIds = (db.inventario_itens || []).filter(it => it.inventario_id === invId).map(it => it.equipamento_id);
      const naoLoc = esperados.filter(e => !lidosIds.includes(e.id));
      inv.total_nao_localizados = naoLoc.length;
      naoLoc.forEach(nl => {
        db.inventario_itens.push({
          id: Date.now() + Math.random(),
          inventario_id: invId,
          equipamento_id: nl.id,
          equipamento_nome: nl.nome,
          codigo_patrimonio: nl.codigo_patrimonio,
          patrimonio_ufpi: nl.patrimonio_ufpi,
          codigo_labcontrol: nl.codigo_labcontrol,
          espaco_esperado_id: inv.espaco_id,
          espaco_encontrado_id: inv.espaco_id,
          status_conferencia: 'nao_localizado',
          decisao_admin: 'pendente'
        });
      });
      saveStorage(db);
      return ok({ message: 'Inventário concluído', inventario: inv });
    }
    return ok({ message: 'Inventário finalizado' });
  }

  if (cleanUrl.match(/\/inventarios\/\d+/)) {
    const invId = Number(cleanUrl.split('/')[2]);
    const inv = (db.inventarios || []).find(i => i.id === invId);
    if (inv) {
      const esperados = db.equipamentos.filter(e => Number(e.espaco_id) === Number(inv.espaco_id) && !e.inativo);
      const itens = (db.inventario_itens || []).filter(it => it.inventario_id === invId);
      return ok({ ...inv, esperados, itens });
    }
  }

  // Fallback genérico para qualquer outra rota
  return ok({ message: 'Operação simulada com sucesso (Modo Demo)' });
}

