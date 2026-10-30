// Formato de cifras para el consumo (en español: 12 345 · 0,0004 US$).

const tokens = new Intl.NumberFormat('es-ES');
const time = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function formatTokens(n: number): string {
  return tokens.format(n);
}

/** Céntimos con dos decimales; cantidades pequeñas con dos cifras significativas. */
export function formatCost(usd: number | null): string {
  if (usd === null) return '—';
  if (usd === 0) return '0 US$';
  const opts: Intl.NumberFormatOptions =
    usd >= 0.01 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumSignificantDigits: 2 };
  return `${new Intl.NumberFormat('es-ES', opts).format(usd)} US$`;
}

export function formatTime(ms: number): string {
  return time.format(ms);
}
