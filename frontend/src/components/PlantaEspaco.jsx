import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { getFallbackPosition, normalizeLocation, PLANTA_DEMONSTRACAO } from '../config/plantasEspacos';

function buildPlanMarkers(equipamentos, planta) {
  const locations = new Map();

  equipamentos.forEach((equipment) => {
    const label = equipment.localizacao_detalhada?.trim() || 'Localização não informada';
    const key = normalizeLocation(label);
    if (!locations.has(key)) locations.set(key, { key, label, equipments: [] });
    locations.get(key).equipments.push(equipment);
  });

  return [...locations.values()].flatMap((location, locationIndex) => {
    const position = planta.locations[location.key]
      || getFallbackPosition(locationIndex, planta.width, planta.height);

    return location.equipments.map((equipment, equipmentIndex) => {
      const angle = (equipmentIndex / Math.max(1, location.equipments.length)) * Math.PI * 2;
      const radius = location.equipments.length > 1 ? 28 : 0;
      return {
        equipment,
        location: location.label,
        x: position.x + Math.cos(angle) * radius,
        y: position.y + Math.sin(angle) * radius
      };
    });
  });
}

function statusColor(status) {
  const normalized = String(status || '').toLocaleLowerCase('pt-BR');
  if (normalized === 'disponivel') return '#059669';
  if (normalized === 'em_uso') return '#d97706';
  if (normalized.includes('manutencao')) return '#e11d48';
  return '#64748b';
}

function PlaceholderRoom({ width, height }) {
  const wall = 14;
  const benchWidth = width * 0.19;
  const benchHeight = height * 0.15;

  return (
    <g aria-hidden="true">
      <rect width={width} height={height} fill="#e8f0ed" />
      <path d={`M 0 ${height * 0.5} H ${width}`} stroke="#d5e0dc" strokeWidth="2" strokeDasharray="8 8" />
      <rect x={wall} y={wall} width={width - wall * 2} height={height - wall * 2} rx="8" fill="#f8faf9" stroke="#475569" strokeWidth="8" />

      <rect x={width * 0.38} y={wall - 2} width={width * 0.24} height="10" fill="#f8faf9" />
      <line x1={width * 0.39} y1={wall + 3} x2={width * 0.61} y2={wall + 3} stroke="#38bdf8" strokeWidth="5" />
      <line x1={wall + 2} y1={height * 0.43} x2={wall + 2} y2={height * 0.63} stroke="#38bdf8" strokeWidth="5" />

      <rect x={width * 0.42} y={height - wall - 5} width={width * 0.16} height="14" fill="#f8faf9" />
      <path d={`M ${width * 0.42} ${height - wall} A ${width * 0.16} ${width * 0.16} 0 0 1 ${width * 0.58} ${height - wall}`} fill="none" stroke="#64748b" strokeWidth="2" strokeDasharray="5 4" />
      <text x={width / 2} y={height - wall - 14} fill="#64748b" fontSize="12" textAnchor="middle">ENTRADA</text>

      <g fill="#dbeafe" stroke="#94a3b8" strokeWidth="3">
        <rect x={width * 0.075} y={height * 0.12} width={benchWidth} height={benchHeight} rx="8" />
        <rect x={width * 0.73} y={height * 0.12} width={benchWidth} height={benchHeight} rx="8" />
        <rect x={width * 0.075} y={height * 0.7} width={benchWidth} height={benchHeight} rx="8" />
        <rect x={width * 0.405} y={height * 0.7} width={benchWidth} height={benchHeight} rx="8" />
        <rect x={width * 0.73} y={height * 0.7} width={benchWidth} height={benchHeight} rx="8" />
      </g>
      <g fill="#64748b" fontSize="11" textAnchor="middle">
        <text x={width * 0.17} y={height * 0.21}>BANCADA</text>
        <text x={width * 0.825} y={height * 0.21}>EQUIPAMENTO</text>
        <text x={width * 0.17} y={height * 0.79}>BANCADA</text>
        <text x={width * 0.5} y={height * 0.79}>BANCADA</text>
        <text x={width * 0.825} y={height * 0.79}>BANCADA</text>
      </g>
    </g>
  );
}

export default function PlantaEspaco({ equipamentos = [], planta = PLANTA_DEMONSTRACAO }) {
  const markers = buildPlanMarkers(equipamentos, planta);

  return (
    <section className="space-y-4" aria-labelledby="planta-espaco-titulo">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 id="planta-espaco-titulo" className="text-sm font-bold text-slate-800">Planta 2D do espaço</h3>
          <p className="mt-1 text-xs text-slate-500">
            Planta de demonstração sem escala. Os marcadores seguem a localização cadastrada dos equipamentos.
          </p>
        </div>
        <span className="text-xs text-slate-400">
          {markers.length} {markers.length === 1 ? 'equipamento' : 'equipamentos'}
        </span>
      </header>

      {markers.length === 0 ? (
        <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-xs text-slate-500">
          Nenhum equipamento cadastrado neste espaço para exibir na planta.
        </div>
      ) : (
        <>
          <div
            className="relative isolate w-full overflow-hidden rounded-xl border-2 border-slate-400 bg-slate-50 shadow-inner"
            style={{ aspectRatio: `${planta.width} / ${planta.height}` }}
            aria-label="Planta esquemática com equipamentos posicionados por localização"
          >
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox={`0 0 ${planta.width} ${planta.height}`}
              role="img"
              aria-label={planta.backgroundImage ? 'Planta do laboratório' : 'Planta vetorial de demonstração do laboratório'}
              preserveAspectRatio="none"
            >
              {planta.backgroundImage
                ? <image href={planta.backgroundImage} width={planta.width} height={planta.height} preserveAspectRatio="none" />
                : <PlaceholderRoom width={planta.width} height={planta.height} />}
              <rect
                x="4"
                y="4"
                width={planta.width - 8}
                height={planta.height - 8}
                rx="10"
                fill="none"
                stroke="#334155"
                strokeWidth="8"
              />
            </svg>

            {markers.map(({ equipment, location, x, y }, index) => (
              <Link
                key={equipment.id}
                to={`/equipamentos/${equipment.id}`}
                aria-label={`Equipamento ${index + 1}: ${equipment.nome}, patrimônio ${equipment.codigo_patrimonio || 'não informado'}, localização ${location}`}
                title={`${equipment.nome} — ${location}`}
                className="absolute flex max-w-[34%] -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-lg bg-white/95 px-1.5 py-1 shadow-md ring-1 ring-slate-300 transition hover:z-10 hover:scale-105 hover:ring-teal-500 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 sm:max-w-[24%] sm:px-2"
                style={{
                  left: `${(x / planta.width) * 100}%`,
                  top: `${(y / planta.height) * 100}%`
                }}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow"
                  style={{ backgroundColor: statusColor(equipment.status) }}
                >
                  {index + 1}
                </span>
                <span className="mt-0.5 max-w-full truncate text-center text-[9px] font-semibold text-slate-700 sm:text-[10px]">
                  {equipment.nome}
                </span>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {markers.map(({ equipment, location }, index) => (
              <Link
                key={equipment.id}
                to={`/equipamentos/${equipment.id}`}
                className="flex min-w-0 items-start gap-2 rounded-lg border border-slate-200 bg-white p-2.5 hover:border-teal-300 hover:bg-teal-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              >
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: statusColor(equipment.status) }}
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-semibold text-slate-800">{equipment.nome}</span>
                  <span className="block truncate text-[10px] text-slate-500">
                    {equipment.codigo_patrimonio || 'Patrimônio não informado'} · {location}
                  </span>
                </span>
                <MapPin className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
