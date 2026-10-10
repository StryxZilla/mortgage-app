// Fixed bands let users compare cities without changing the meaning of a color.
export const priceBands = [
  { upper: 250000, label: 'Under $250k', color: '#edf4ef' },
  { upper: 500000, label: '$250–500k', color: '#d2e5d9' },
  { upper: 750000, label: '$500–750k', color: '#9bc9b5' },
  { upper: 1000000, label: '$750k–1m', color: '#61a99d' },
  { upper: 1500000, label: '$1–1.5m', color: '#3f808f' },
  { upper: 2000000, label: '$1.5–2m', color: '#546698' },
  { upper: Infinity, label: '$2m+', color: '#655086' },
];
export const missingPriceColor = '#d7dcd8';

export function medianColor(data) {
  if (!Number.isFinite(data?.value) || data.value <= 0) return missingPriceColor;
  return priceBands.find(band => data.value < band.upper).color;
}

export function medianLabel(data) {
  if (!Number.isFinite(data?.value) || data.value <= 0) return 'No reported median';
  return `$${data.value.toLocaleString('en-US')}${data.atLeast ? '+' : data.atMost ? ' or less' : ''}`;
}
