/**
 * A ticket is what opens a sealed account: the exact text and the salt. It is
 * kept in this browser only, under the contract, the page, the round and the
 * writer, and it can be downloaded as a file in case the browser forgets it.
 * Losing it before opening means the account cannot be opened, which is a
 * no-show, so the page warns loudly when it is missing.
 */
import { CONTRACT } from './chain';

export type Ticket = { text: string; salt: string; seal: string; page: number; round: number; address: string; contract: string };

const key = (page: number, round: number, address: string) =>
  `samepage:ticket:${CONTRACT.toLowerCase()}:${page}:${round}:${address.toLowerCase()}`;

export function saveTicket(t: Ticket): void {
  try {
    localStorage.setItem(key(t.page, t.round, t.address), JSON.stringify(t));
  } catch {
    // Storage can be unavailable (private windows); the download is the fallback.
  }
}

export function loadTicket(page: number, round: number, address: string): Ticket | null {
  try {
    const raw = localStorage.getItem(key(page, round, address));
    return raw ? (JSON.parse(raw) as Ticket) : null;
  } catch {
    return null;
  }
}

export function downloadTicket(t: Ticket): void {
  const blob = new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `samepage-page-${t.page}-round-${t.round}-ticket.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseTicket(raw: string): Ticket | null {
  try {
    const t = JSON.parse(raw) as Ticket;
    return typeof t.text === 'string' && typeof t.salt === 'string' ? t : null;
  } catch {
    return null;
  }
}
