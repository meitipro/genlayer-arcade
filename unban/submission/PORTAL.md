# Portal submission

Fields in the order of the form. Character counts are measured. Lines marked PENDING come from the /run page after the site is live; nothing here is invented.

## 1. Make it recognizable

- Logo: `logo-512.png`
- Project name: Unban - ban appeals ruled by the community's own rules
- Primary tag: Dispute Resolution
- Tag 1: Social
- Tag 2: Governance

## 2. One-liner (104 characters)

Ban appeals for online communities, ruled by GenLayer validators from the community's own written rules.

## 3. Description (max 1000) (802 characters)

Unban is a ban appeal court for online communities on GenLayer. A Discord, Telegram or X community writes its numbered rules and a penalty ladder once, lists its moderators and funds a small compensation pool. A banned member appeals with a small fee, which reserves compensation from the pool. A listed moderator answers with the rule cited, the penalty applied and the quoted messages, and the member may reply once. Validators then rule from the written rules alone: UPHELD, REDUCED to the level the ladder sets, or OVERTURNED with the fee refunded plus compensation. An appeal nobody answers in time is DEFAULTED to the member. Validators agree on the verdict and level only, rules freeze while appeals are open, and money moves only through withdraw. A read-only bot applies rulings in the server.

## 4. Show it in action

Demo URL: PENDING (record `DEMO.md`)

## 5. Write the exact path

### Step 1: Fund a wallet (237 characters)

Open use-unban.vercel.app, select Connect wallet in the header and approve MetaMask, which adds GenLayer Studio Next (chain 61997). On any form, select Get test GEN if the wallet is empty; the faucet reports the balance before and after.

### Step 2: Open a court (263 characters)

Select Open a court, choose the Crypto Discord template (5 rules, ladder P1 warning to P4 ban), keep your address as moderator, fee 2, compensation 5, window 48 h, pool 10, then Open the court and confirm. The court page shows the rules, the pool and the reserve.

### Step 3: File an appeal (260 characters)

From a second wallet, open the court, select File an appeal, write the handle ardal, today's date and a statement saying you asked when the team unlock starts. The form lists every outcome before signing. Confirm the 2 GEN fee; 5 GEN is reserved from the pool.

### Step 4: Answer as moderator (262 characters)

Switch back to the moderator wallet and open For moderators. Select the appeal, pick rule 1 insults and P4 ban, paste the quote [14:02] ardal: when does the team unlock start? and Submit answer. The ladder hint warns when the level is heavier than the rule sets.

### Step 5: Reply and rule (269 characters)

With the member wallet, open the appeal page, send one reply (Rule 1 is about insults; a question is neither), then select Ask the validators to rule. The page shows Validators are reviewing, then OVERTURNED with the one-sentence reason and 7 GEN in the member balance.

### Step 6: Withdraw (248 characters)

On the same page select Withdraw 7 GEN and confirm. It waits for finality, then the wallet balance rises by 7 GEN less the fee deposit spent, and the contract's own balance drops by exactly 7 GEN. Withdraw again is refused with nothing to withdraw.

## 6. Prove the path works: expected verification outcome (stewards, max 500) (390 characters)

The appeal page shows OVERTURNED, rule 1, P4 applied, a one-sentence reason and Settlement: fee back 2 GEN, compensation 5 GEN. On the explorer, the judge transaction is accepted and returned; the withdraw transaction is finalized and the contract balance falls by exactly 7 GEN. Every write's receipt is checked for an accepted outcome and a return, so a refusal is never shown as success.

Contract and transaction links: PENDING, copy the "Links for the portal form" box from https://use-unban.vercel.app/run

## 7. Send people to it

- Website: https://use-unban.vercel.app
- GitHub: https://github.com/meitipro/genlayer-arcade/tree/claude/inspiring-dijkstra-6cskv8/unban
