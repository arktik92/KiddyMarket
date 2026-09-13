// Currency + date helpers (French / EUR).
export function formatEuros(cents: number): string {
  const euros = (cents / 100).toFixed(2).replace(".", ",");
  return `${euros} €`;
}

// Parse a French amount string ("5,00" or "5.5") into integer cents.
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, "").replace(",", ".");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  if (Number.isNaN(value) || value < 0) return null;
  return Math.round(value * 100);
}

const MONTHS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} · ${hh}:${mm}`;
}
