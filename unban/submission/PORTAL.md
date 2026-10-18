# Portal submission

Character counts are measured. Links marked PENDING are filled from deployment.json, eval/results.json and evidence/walk.json after the scripts run (see ../HANDOFF.md); nothing here is invented.

## Project name (54 characters)

Unban - ban appeals ruled by the community's own rules

## Tags

Primary tag: Dispute Resolution

Tag 1: Social

Tag 2: Governance

## One-liner (104 characters)

Ban appeals for online communities, ruled by GenLayer validators from the community's own written rules.

## Description (max 1000) (802 characters)

Unban is a ban appeal court for online communities on GenLayer. A Discord, Telegram or X community writes its numbered rules and a penalty ladder once, lists its moderators and funds a small compensation pool. A banned member appeals with a small fee, which reserves compensation from the pool. A listed moderator answers with the rule cited, the penalty applied and the quoted messages, and the member may reply once. Validators then rule from the written rules alone: UPHELD, REDUCED to the level the ladder sets, or OVERTURNED with the fee refunded plus compensation. An appeal nobody answers in time is DEFAULTED to the member. Validators agree on the verdict and level only, rules freeze while appeals are open, and money moves only through withdraw. A read-only bot applies rulings in the server.

## Show it in action

Demo video: PENDING, record `DEMO.md` once the deployment and seed exist.

## Write the exact path

### 1. Fund a wallet (225 characters)

Open the site, select Connect wallet in the header and approve MetaMask, which adds GenLayer Studio Next (chain 61997). On any form, select Get test GEN if the wallet is empty; the faucet reports the balance before and after.

### 2. Open a court (263 characters)

Select Open a court, choose the Crypto Discord template (5 rules, ladder P1 warning to P4 ban), keep your address as moderator, fee 2, compensation 5, window 48 h, pool 10, then Open the court and confirm. The court page shows the rules, the pool and the reserve.

### 3. File an appeal (260 characters)

From a second wallet, open the court, select File an appeal, write the handle ardal, today's date and a statement saying you asked when the team unlock starts. The form lists every outcome before signing. Confirm the 2 GEN fee; 5 GEN is reserved from the pool.

### 4. Answer as moderator (262 characters)

Switch back to the moderator wallet and open For moderators. Select the appeal, pick rule 1 insults and P4 ban, paste the quote [14:02] ardal: when does the team unlock start? and Submit answer. The ladder hint warns when the level is heavier than the rule sets.

### 5. Reply and rule (269 characters)

With the member wallet, open the appeal page, send one reply (Rule 1 is about insults; a question is neither), then select Ask the validators to rule. The page shows Validators are reviewing, then OVERTURNED with the one-sentence reason and 7 GEN in the member balance.

### 6. Withdraw (248 characters)

On the same page select Withdraw 7 GEN and confirm. It waits for finality, then the wallet balance rises by 7 GEN less the fee deposit spent, and the contract's own balance drops by exactly 7 GEN. Withdraw again is refused with nothing to withdraw.

## Prove the path works: expected verification outcome (stewards, max 500) (390 characters)

The appeal page shows OVERTURNED, rule 1, P4 applied, a one-sentence reason and Settlement: fee back 2 GEN, compensation 5 GEN. On the explorer, the judge transaction is accepted and returned; the withdraw transaction is finalized and the contract balance falls by exactly 7 GEN. Every write's receipt is checked for an accepted outcome and a return, so a refusal is never shown as success.

## Contract and transaction links

- Contract: PENDING (`deployment.json` -> `https://explorer-studio-dev.genlayer.com/address/<address>`)
- Deploy transaction: PENDING
- Golden run, 12 judge transactions: PENDING (`eval/results.md`)
- Reviewer's walk, 9 transactions including 2 refusals: PENDING (`evidence/walk.json`)

## Send people to it

- Website: PENDING (Vercel project, root `unban/web`)
- GitHub: https://github.com/meitipro/genlayer-arcade/tree/claude/inspiring-dijkstra-6cskv8/unban

## Images

- Logo, 512 x 512: `logo-512.png` (`logo.svg`)
- Cover, 1600 x 900: `cover-1600x900.png`
