<div align="center">

<img src="submission/logo-256.png" width="96" alt="Samepage" />

# Samepage

**Two accounts of one deal, checked before anyone signs.**

A deal check on GenLayer Studio Next (chain 61997)

</div>

The two sides of a deal each write it in their own words, sealed so neither can copy the other. GenLayer validators compare the two accounts on six terms (amount, deliverable, deadline, payment, rights and cancellation), and the contract computes the result from their six labels. The deal is signed only when both describe the same thing, with a good-faith deposit that stops either side from ghosting.

| | |
| --- | --- |
| Contract | [`0x6654e80CA0656CC007991D073a274D1067F82999`](https://explorer-studio-dev.genlayer.com/address/0x6654e80CA0656CC007991D073a274D1067F82999) on Studio Next |
| Deploy transaction | [`0x582486af…`](https://explorer-studio-dev.genlayer.com/tx/0x582486afa6be2e8cb8ff1a54f35d8f4bb3cdd5c07bac5224c4db19ea84a5a726), source read back from the chain byte for byte (`chain/out/verify.log`) |
| Runtime | `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`, from the Recourse Studio Next port |
| Golden cases | 8 of 9 scored cases matched on all six statuses through real consensus; 3 held out; [eval/results.md](eval/results.md) |
| Tests | 100 direct and static tests, 41 mutations none escaping ([tests/MUTATIONS.md](tests/MUTATIONS.md)) |
| Reviewer's path | page #21 through the site's own signing code: two rounds, five refusals on chain, both withdrawals exact to the wei ([chain/out/site-e2e.json](chain/out/site-e2e.json)) |
| Real browser | page #22, 11 transactions signed in Playwright through `window.ethereum`, open to withdraw ([screens](chain/out/screens)) |
| Site and docs | [`web/`](web), a static Next.js export with genlayer-js 2.0.0-rc.1 and Fumadocs, deployed as this branch's Vercel preview |
| No-show | page #20: the counterparty joined and never sealed; after the window a stranger settled it and both deposits went to the side that showed up ([chain/out/no-show.json](chain/out/no-show.json)) |
| Every link | [submission/EVIDENCE.md](submission/EVIDENCE.md), generated from the run records |

## How it works

1. **Open.** One side opens a page with a title, the counterparty's address, a deposit (possibly zero) and a window of 6 to 96 hours per step. The named counterparty joins with the same deposit.
2. **Seal.** Each side writes the deal in its own words, up to 1,200 characters in any language, and seals `sha256(text|salt|address)`. The salt is hex only, so a preimage splits into text and salt in exactly one way, and the address is inside the hash, so a copied seal can never be opened.
3. **Open.** When both have sealed, both open. An account that does not match its seal is refused.
4. **Check.** Anyone calls `check`. Every validator asks the rubric of the build spec, word for word, in both presentation orders, and must agree on all six labels (MATCH, DIFFER, ABSENT). A term the two orders read differently is stored as DIFFER. The contract computes the result from the labels: **SAME PAGE**, **DIFFERENT · N** or **GAPS · N**.
5. **Sign.** On SAME PAGE both sign and both deposits go back into their balances. Otherwise each side writes round 2. A second miss closes the page NOT AGREED with both deposits returned.
6. **No-shows.** After any missed window anyone can call `no_show`: the absent side's deposit goes to the other.
7. **Withdraw.** Money leaves only through `withdraw()`, a top-level transfer. `check`, `sign` and `no_show` move balances only, because consensus v0.6 funds a value transfer only at the root of a transaction.

## The contract

`contracts/samepage.py`: exactly the ten methods of section 4 of the spec, `genvm-lint` lint and validate clean under GenVM v0.6.0-rc5, and the same checks rerun over the bytes read back from the chain.

| method | kind | |
| --- | --- | --- |
| `open_page(title, counterparty, deposit, window_hours)` | payable | opens a page with the opener's deposit |
| `join(page_id)` | payable | the named counterparty joins with the same deposit |
| `seal(page_id, seal)` | write | seals this round's account, once per side per round |
| `reveal(page_id, text, salt)` | write | opens an account after both sealed, checked against its seal |
| `check(page_id)` | write, nondet | six statuses, the verdict computed in code |
| `sign(page_id)` | write | both signatures make it AGREED |
| `no_show(page_id)` | write | after a missed window, settles by rule |
| `withdraw()` | write, pays | top-level transfer of the caller's balance |
| `get_page(page_id)` | view | everything about one page |
| `list_pages(address, offset, limit)` | view | an address's pages, balance and no-shows; the zero address lists all |

## Repository

```
samepage/
  contracts/samepage.py          the one contract, judge prompt pinned inside
  tests/test_direct.py           every method and rule, judge mocked
  tests/test_static.py           ten methods, every write bound to an address, fences, no floats
  tests/vectors.json             sha256 vectors shared with the browser
  tests/MUTATIONS.md             41 mutations of the defences, each caught
  eval/golden.json, GOLDEN.lock  written and hashed before the first run
  eval/run_golden.py, results.*  the golden run, every transaction listed
  scripts/deploy.py, verify.py   deploy, read back, diff and lint the deployed bytes
  scripts/seed.py, no_show.py    the front page's pages
  scripts/mutate.py              the mutation table
  chain/out/                     every run's log and record, committed by the runner
  web/                           the site and /docs
  submission/                    portal text, X post, demo script, logo
```

## Running it

```bash
cd samepage
pip install -r requirements.txt
python -m pytest tests -q                 # 100 tests, no network
python scripts/mutate.py                  # the mutation table
python scripts/deploy.py                  # needs Studio Next; makes a fresh account
python eval/run_golden.py                 # golden cases through consensus
cd web && npm ci && npm run build         # static export in web/out, link check included
npm run dev                               # http://localhost:4600
```

The development container this was built in cannot reach the GenLayer RPC, so every chain run in this repository happened on a GitHub runner (`.github/workflows/samepage-chain.yml`, driven by `chain/REQUEST.json`) and committed its logs back under `chain/out/`. Every account was made inside its run and only its address was ever printed.

## Honest limits

Samepage checks that two accounts describe the same deal, not that the deal is fair, legal or kept. It holds no payment for the work and judges no delivery, and both accounts are public once opened, so it suits deals that can be public. Golden case 6 (case 1 in Persian against English) came back DIFFERENT on payment and is published as a miss; the rubric was not changed to make it pass.
