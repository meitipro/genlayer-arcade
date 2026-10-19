/**
 * Term hints for common deals. Never prefilled accounts: a template the other
 * side wrote would be the framing Samepage exists to avoid, so these are
 * questions each side answers in their own words.
 */
import type { Term } from './chain';

export type Template = { slug: string; name: string; who: string; title: string; hints: Record<Term, string> };

export const TEMPLATES: Template[] = [
  {
    slug: 'promotion',
    name: 'Paid promotion',
    who: 'A project and a creator',
    title: 'Launch posts',
    hints: {
      amount: 'How much, in which token, and for how many posts or videos.',
      deliverable: 'Which platform, how many posts, threads or videos, and what each must cover.',
      deadline: 'The date each piece goes live, written as a date rather than "Friday".',
      payment: 'Upfront, after, or split, and when each part is sent.',
      rights: 'Whether the project may repost, quote, pin or use the content in ads.',
      cancellation: 'What happens if the project cancels, or the post is never made.',
    },
  },
  {
    slug: 'design',
    name: 'Design gig',
    who: 'A client and a freelancer',
    title: 'Logo for the launch',
    hints: {
      amount: 'The price and the token, and how many concepts and revisions it covers.',
      deliverable: 'Which files: source files, vector, PNGs, sizes and colour versions.',
      deadline: 'The date of the first concepts and of the final files.',
      payment: 'How it is split between start, concepts and final files.',
      rights: 'Who owns the result, and whether the designer may show it in a portfolio.',
      cancellation: 'A kill fee if the client stops, and what is handed over if they do.',
    },
  },
  {
    slug: 'otc',
    name: 'OTC trade',
    who: 'Two traders',
    title: '40k ARB for USDC',
    hints: {
      amount: 'The exact quantity on each side and the price per token.',
      deliverable: 'Which tokens, which chain, and to which addresses.',
      deadline: 'The date and time by which both legs settle, with a timezone.',
      payment: 'Who sends first, in what order, and in how many parts.',
      rights: 'Usually none; say so if a lock-up or vesting applies.',
      cancellation: 'What happens if one side does not send, and whether the price may move.',
    },
  },
  {
    slug: 'ambassador',
    name: 'Ambassador role',
    who: 'A project and a community member',
    title: 'Ambassador, three months',
    hints: {
      amount: 'The monthly amount and token, and any bonus with its condition.',
      deliverable: 'What is expected each week: posts, events, moderation hours.',
      deadline: 'The start date, the end date, and when each month is reviewed.',
      payment: 'Monthly, after review, or vested, and on which day.',
      rights: 'Use of the project name and logo, and of the content produced.',
      cancellation: 'Notice either side gives, and what is paid for a partial month.',
    },
  },
];
