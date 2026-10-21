# Portal entry

Every field of the submission form, ready to paste. Character counts are checked by the script that wrote `submission/portal.json`.

**Project name:** Unban - ban appeals decided by the community's own rules

**Primary tag:** Dispute Resolution  
**Tag 1:** Moderation Appeals  
**Tag 2:** Community Governance

**Logo:** `web/public/logo-512.png` (512 × 512)

## One-liner (104 characters)

Ban appeals for online communities, ruled by GenLayer validators from the community's own written rules.

## Description (831/1000)

Unban is a ban appeal court for online communities on GenLayer. A community writes its rules and a penalty ladder once, lists its moderators and funds a small compensation pool. A banned member appeals with a fee, a moderator answers with the rule cited, the penalty applied and the quoted messages, and the member may reply once. Validators then rule from the written rules alone whether the ban is upheld, reduced to the level the ladder sets, or overturned, and agree only on the verdict and the level. When the member was right the fee comes back with compensation reserved at filing, and if no moderator answers in time the appeal is granted by default. A read-only Discord bot applies each ruling with the server's own token. One contract with twelve methods, deployed on Studio Next; golden cases run through real consensus.

## Why stewards should care (426/500)

Every crypto community, GenLayer's own included, has had a wrongful ban and an appeal that went nowhere. Unban gives moderation the one thing it lacks: a second look by someone who did not make the call, bound to rules written in advance. It is honest about its limits: it rules on the record, not on what was really said. It follows the Studio Next lessons: text only, label-only agreement, top-level payouts, fenced prompts.

## The exact path

1. **Fund two wallets** (350/500)  
   Open use-unban.vercel.app and select Connect wallet, then approve the switch to GenLayer Studio Next (chain 61997). Select Get test GEN in the header; it calls Studio's faucet and shows the balance once the GEN lands. Do the same for a second wallet in another browser profile: wallet A will own and moderate the court, wallet B is the banned member.

2. **Open a court** (336/500)  
   With wallet A select Open a court. Keep the Kiln template (five rules, a four-step ladder ending in ban), name it, select Add my address under Moderators, keep fee 2, compensation 5, window 48 h and pool 100. Select Open the court; the fee deposit is shown before signing. The court page opens with the rules, ladder and a 100 GEN pool.

3. **File an appeal** (321/500)  
   With wallet B open the court page and select File an appeal. Case: ardal (Discord 418236001190019072), banned in #general. Statement: I asked in #general when the team unlock starts and was banned a minute later for FUD. The form shows what each ruling pays. Sign: 2 GEN is sent and 5 GEN of the pool is reserved for you.

4. **Answer as the moderator** (315/500)  
   With wallet A open For moderators. The appeal is listed with its hours left. Pick rule 1 (insults) and P4 ban, paste: [14:02] ardal: when does the team unlock start? the docs say Q4, the dashboard says November, then select Submit answer. The appeal page now shows the moderator's answer next to wallet A's address.

5. **Reply and ask for a ruling** (262/500)  
   With wallet B open the appeal page, write the one reply: Rule 1 is about insults and harassment. Asking which date is right is neither. Send it, then select Ask the validators to rule (anyone may). The page shows Validators are reviewing until consensus decides.

6. **Read the ruling and withdraw** (257/500)  
   The appeal shows OVERTURNED with the validators' one-sentence reason, 7 GEN to the member and the bot's action: lifts the ban. With wallet B select Withdraw 7 GEN; it is a single top-level transfer and the header balance rises by 7 GEN less the fee deposit.

## Expected verification outcome (352/500)

The appeal page reads OVERTURNED with a reason saying a civil question breaks no written rule, settlement 2 GEN fee back plus 5 GEN compensation, and wallet B's balance rises after withdraw. On the explorer the judge transaction is accepted by the validators; a stranger's respond on the same appeal is refused with only a listed moderator may respond.

## Links

- Website: https://use-unban.vercel.app
- GitHub: https://github.com/meitipro/genlayer-unban
- Contract and transactions: see `HANDOFF.md`; they exist only after `scripts/deploy.py` and `scripts/e2e.py` run against Studio Next.
