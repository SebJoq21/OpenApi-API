export function getBusinessYear(now: Date = new Date()): number {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    year: 'numeric',
  }).format(now);
  return Number(formatted);
}

export function formatNumeroOrden(year: number, ultimo: number): string {
  return `ORD-${year}-${String(ultimo).padStart(3, '0')}`;
}
