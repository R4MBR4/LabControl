import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';

function buildPlanZones(equipments) {
  const zones = new Map();

  equipments.forEach((equipment) => {
    const label = equipment.localizacao_detalhada?.trim() || 'Localização não informada';
    const key = label.toLocaleLowerCase('pt-BR');
    if (!zones.has(key)) zones.set(key, { key, label, equipments: [] });
    zones.get(key).equipments.push(equipment);
  });

  return [...zones.values()];
}

function statusStyle(status) {
  const normalized = String(status || '').toLocaleLowerCase('pt-BR');
  if (normalized === 'disponivel') return 'bg-emerald-100 text-emerald-800';
  if (normalized === 'em_uso') return 'bg-amber-100 text-amber-800';
  if (normalized.includes('manutencao')) return 'bg-rose-100 text-rose-800';
  return 'bg-slate-100 text-slate-700';
}

export default function PlantaEspaco({ equipamentos = [] }) {
  const zones = buildPlanZones(equipamentos);

  return (
    <section className="space-y-4" aria-labelledby="planta-espaco-titulo">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 id="planta-espaco-titulo" className="text-sm font-bold text-slate-800">Planta esquemática do espaço</h3>
          <p className="mt-1 text-xs text-slate-500">
            Equipamentos agrupados pelas localizações cadastradas. Representação visual sem escala.
          </p>
        </div>
        <span className="text-xs text-slate-400">{zones.length} {zones.length === 1 ? 'localização' : 'localizações'}</span>
      </header>

      {zones.length === 0 ? (
        <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-xs text-slate-500">
          Nenhum equipamento cadastrado neste espaço para exibir na planta.
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-slate-300 bg-slate-100 p-3 sm:p-5">
          <div className="mb-3 flex items-center justify-between border-b border-dashed border-slate-300 pb-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Área interna</span>
            <span className="text-[10px] text-slate-400">Vista superior esquemática</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {zones.map((zone, zoneIndex) => (
              <section
                key={zone.key}
                aria-label={`Localização: ${zone.label}`}
                className={`min-w-0 rounded-xl border border-slate-300 bg-white p-3 shadow-sm ${
                  zones.length % 2 === 1 && zoneIndex === zones.length - 1 ? 'sm:col-span-2' : ''
                }`}
              >
                <div className="mb-2 flex min-w-0 items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <h4 className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-slate-800">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                    <span className="truncate" title={zone.label}>{zone.label}</span>
                  </h4>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    {zone.equipments.length}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {zone.equipments.map((equipment) => (
                    <li key={equipment.id}>
                      <Link
                        to={`/equipamentos/${equipment.id}`}
                        className="flex min-w-0 items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[11px] font-medium text-slate-700" title={equipment.nome}>
                            {equipment.nome}
                          </span>
                          <span className="block truncate text-[10px] text-slate-400" title={equipment.codigo_patrimonio}>
                            {equipment.codigo_patrimonio || 'Patrimônio não informado'}
                          </span>
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${statusStyle(equipment.status)}`}>
                          {equipment.status || 'Sem status'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
