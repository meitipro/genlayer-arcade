/**
 * Which terms a text seems to mention, worked out in the browser from the
 * writer's own text only. A hint, not the judge: the validators read both
 * accounts and nothing here is sent anywhere.
 */
import type { Term } from './chain';

const PATTERNS: Record<Term, RegExp[]> = {
  amount: [
    /\b\d[\d,.]*\s*(k\b)?\s*(usdc|usdt|usd|eth|gen|dai|arb|op|sol|btc|\$|dollars?|eur|€)/i,
    /(\$|€)\s*\d/,
    /\b(price|fee|rate|budget|costs?|pay(s|ing)?\s+\d)/i,
    /[۰-۹]{2,}|تومان|دلار/,
  ],
  deliverable: [
    /\b(posts?|tweets?|threads?|videos?|logos?|designs?|articles?|landing page|website|pages?|code|audit|report|tokens?|deliver(s|ed|ables?)?|writes?|builds?|designs?)\b/i,
    /پست|طراحی|لوگو|ویدیو/,
  ],
  deadline: [
    /\b(by|before|until|due|deadline)\b[^.]{0,30}\b(\d{1,2}|mon|tue|wed|thu|fri|sat|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|tomorrow|week|month|end)/i,
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b/i,
    /\b\d{4}-\d{2}-\d{2}\b/,
    /تا\s|مهلت/,
  ],
  payment: [
    /\b(upfront|up front|in advance|after|on delivery|half|milestones?|installments?|paid|pays?|payment|escrow|net\s*\d+)\b/i,
    /پرداخت|پیش‌?پرداخت/,
  ],
  rights: [
    /\b(owns?|ownership|rights?|license[sd]?|licen[cs]e|copyright|repost|reuse|quote|exclusive|source files?|ip\b|credit)\b/i,
    /مالکیت|حق/,
  ],
  cancellation: [
    /\b(cancel(s|led|lation)?|refund(s|ed)?|backs? out|walks? away|kill fee|terminate|termination|withdraw)\b/i,
    /لغو|بازپرداخت/,
  ],
};

export function mentions(text: string): Record<Term, string | null> {
  const out = {} as Record<Term, string | null>;
  for (const term of Object.keys(PATTERNS) as Term[]) {
    let found: string | null = null;
    for (const re of PATTERNS[term]) {
      const m = text.match(re);
      if (m) {
        found = m[0].trim().slice(0, 28);
        break;
      }
    }
    out[term] = found;
  }
  return out;
}
