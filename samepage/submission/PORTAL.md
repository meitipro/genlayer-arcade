# Portal entry

**Project name:** Samepage - two accounts of one deal, checked before anyone signs

**Primary tag:** Dispute Resolution

**Tags:** Deal Verification · Freelance and Creators

**One-liner:** Both sides write the deal in their own words, sealed; GenLayer validators compare six terms and name every difference before anyone signs.

**Description (811 characters):**

Samepage is a deal check on GenLayer. The two sides of a deal, a project and a creator, a client and a freelancer, two traders, each write it in their own words and seal a hash of it, so neither can copy the other. Once both open, validators compare the two accounts on six terms: amount, deliverable, deadline, payment, rights and cancellation. They ask in both orders and must agree on every label. The contract computes SAME PAGE, DIFFERENT or GAPS from those six labels, never from the model's words. Both sides see exactly where they differ, rewrite once, and sign a record holding both texts. A good-faith deposit goes to the other side if one walks away and comes back otherwise. Deployed on Studio Next; golden cases ran through real consensus and are published as they came out: 8 of 9, the miss shown.

**Demo video:** record from `DEMO-SCRIPT.md`; frames from the real browser run are in `../chain/out/screens/`.

## Write the exact path

### 1. Connect a wallet (353 characters)

Open https://genlayergamehub-git-claude-project-dep-a7433e-mahdighs-projects.vercel.app and select Connect wallet; the site adds GenLayer Studio Next (chain 61997) to the wallet. Nothing else is needed: before any write, if the wallet holds less GEN than the deposit and fee need, the site tops it up from the Studio faucet and shows the balance moving.

### 2. Open a page (294 characters)

Select Open a page, choose the Paid promotion template, type a title, paste a second address you control as the counterparty, set the deposit to 2 GEN and the window to 24 hours, then select Open the page and confirm. The fee estimate shows before you sign, and you land on the page at /p/<id>.

### 3. Join as the counterparty (226 characters)

Switch the wallet to the second address, open the same /p/<id> link and select Join with 2 GEN. Only the named address can join: try it from a third address and the contract refuses with "only the named counterparty can join".

### 4. Write and seal both accounts (291 characters)

As each side, write the deal in your own words (for example 3 posts and one thread on X, 600 USDC, half before and half after, live by Oct 24) and select Seal my account. Only the hash is on chain; the side panel shows the other side's seal and nothing else. The ticket stays in the browser.

### 5. Open and check (286 characters)

As each side select Open my account; a text that does not match its seal is refused. Then anyone selects Run the check: the page shows Validators are comparing, then the six statuses with DIFFER rows hatched and both accounts side by side. On DIFFERENT or GAPS each side writes round 2.

### 6. Sign and withdraw (261 characters)

On SAME PAGE both sides select Sign the record; the page turns AGREED and /p/<id>/record shows both texts, the six statuses and both signatures. On My pages each side selects Withdraw 2 GEN: withdraw is the only call that pays, as its own top-level transaction.

## Prove the path works

**Expected verification (340 characters):** The page reads AGREED, its record shows both accounts and six statuses, and each side's 2 GEN is back after Withdraw. Our browser run did exactly this: page #22, 11 transactions signed in a real browser, check https://explorer-studio-dev.genlayer.com/tx/0xd91d456b59b9081785ca52c8d1b00612ad2183a4da6571674e1ebe6fb69e788c returned SAME PAGE.

**Contract link:** https://explorer-studio-dev.genlayer.com/address/0x6654e80CA0656CC007991D073a274D1067F82999

**Website:** https://genlayergamehub-git-claude-project-dep-a7433e-mahdighs-projects.vercel.app

**GitHub:** https://github.com/meitipro/genlayer-arcade/tree/claude/project-deploy-test-t7j87s/samepage
