// Turkish date display, e.g. "2 Kasım 2026".
const dateFormat = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

export function formatDate(epochMs: number): string {
  return dateFormat.format(epochMs);
}
