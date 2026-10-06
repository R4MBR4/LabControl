export const PLANTA_DEMONSTRACAO = {
  width: 800,
  height: 500,
  backgroundImage: null,
  locations: {
    'bancada 01 - fabricacao digital': { x: 170, y: 125 },
    'area de corte fechada': { x: 615, y: 125 },
    'bancada de montagem rapida': { x: 170, y: 365 },
    'bancada de eletronica 02': { x: 390, y: 365 },
    'célula de automação a': { x: 615, y: 365 },
    'bancada central de optica': { x: 390, y: 245 }
  }
};

export function normalizeLocation(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function getFallbackPosition(index, width, height) {
  const columns = 3;
  const rows = Math.max(1, Math.ceil((index + 1) / columns));
  const column = index % columns;
  const row = Math.floor(index / columns);
  const horizontalPadding = width * 0.16;
  const verticalPadding = height * 0.22;
  const x = columns === 1
    ? width / 2
    : horizontalPadding + column * ((width - horizontalPadding * 2) / (columns - 1));
  const y = rows === 1
    ? height / 2
    : verticalPadding + row * ((height - verticalPadding * 2) / (rows - 1));

  return { x, y };
}
