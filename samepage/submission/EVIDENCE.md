# Evidence, every link read from the run records

Every transaction below was sent by a script or a browser on a GitHub runner and is recorded in `chain/out/` or `eval/`. Nothing here was typed by hand.

## Deployment

- Contract: [`0x6654e80CA0656CC007991D073a274D1067F82999`](https://explorer-studio-dev.genlayer.com/address/0x6654e80CA0656CC007991D073a274D1067F82999) on Studio Next, chain 61997
- Deploy transaction: [`0x582486af…a5a726`](https://explorer-studio-dev.genlayer.com/tx/0x582486afa6be2e8cb8ff1a54f35d8f4bb3cdd5c07bac5224c4db19ea84a5a726), from commit `d5d9338`
- Source read back from the chain: MATCH, byte for byte; sha256 `1f9759d02722c651e42ae7fbdeb17113c81c248deaffe97c5c152762dc49cf80`
- `genvm-lint` over the deployed bytes: lint: exit 0 ✓ Lint passed (3 checks); validate: exit 0 ✓ Validation passed /   Contract: Samepage /   Methods: 10 (2 view, 8 write)

## Golden cases through real consensus

| case | expected | statuses | result | check |
| --- | --- | --- | --- | --- |
| 1 | SAME_PAGE | MATCH · MATCH · MATCH · MATCH · ABSENT · ABSENT | pass | [`0xab227456…46edbc`](https://explorer-studio-dev.genlayer.com/tx/0xab227456bb845d8da9cffd9e89479c001c63ac3579370b1cf5b8e05acc46edbc) |
| 2 | DIFFERENT | DIFFER · MATCH · MATCH · MATCH · ABSENT · ABSENT | pass | [`0x1779b473…bb813b`](https://explorer-studio-dev.genlayer.com/tx/0x1779b4730f1362e81439422f904b214b6aa3d7565c8d688beba52da3a0bb813b) |
| 3 | DIFFERENT | MATCH · MATCH · MATCH · DIFFER · ABSENT · ABSENT | pass | [`0x66bb16a1…2b16fc`](https://explorer-studio-dev.genlayer.com/tx/0x66bb16a130123b664c3fd41d47ada509598ddbf0c7ebb4ab9f26800c0a2b16fc) |
| 4 | DIFFERENT | MATCH · DIFFER · DIFFER · ABSENT · ABSENT · ABSENT | pass | [`0xcd88a24a…1f8589`](https://explorer-studio-dev.genlayer.com/tx/0xcd88a24aa8237527463abd8a23ab8fc9908c44811556085f305184a27a1f8589) |
| 5 | GAPS | ABSENT · MATCH · ABSENT · ABSENT · ABSENT · ABSENT | pass | [`0x5cbf4f99…443781`](https://explorer-studio-dev.genlayer.com/tx/0x5cbf4f99af37504122f28fe8549a8cfca4e88ee47566703a843941a1a9443781) |
| 6 | SAME_PAGE | MATCH · MATCH · MATCH · DIFFER · ABSENT · ABSENT | **miss** | [`0x7adf2693…2eab6d`](https://explorer-studio-dev.genlayer.com/tx/0x7adf2693bb461c862db84b585089ffa8f6e34086251437644d6f493e7e2eab6d) |
| 7 | DIFFERENT | MATCH · MATCH · MATCH · DIFFER · ABSENT · ABSENT | pass | [`0xb326069d…8787dd`](https://explorer-studio-dev.genlayer.com/tx/0xb326069d55622e7c9acceaa2f78bac6356466cebdfb560aaed66dafdff8787dd) |
| 8 | DIFFERENT | DIFFER · MATCH · MATCH · MATCH · ABSENT · ABSENT | pass | [`0x916cfa31…0c5977`](https://explorer-studio-dev.genlayer.com/tx/0x916cfa31f8f7d8668dd35fd2c0b2d735a243e8d9dc50e45d6e8181708a0c5977) |
| 9 | DIFFERENT | MATCH · MATCH · MATCH · MATCH · DIFFER · ABSENT | pass | [`0xc3c14d59…6c4fef`](https://explorer-studio-dev.genlayer.com/tx/0xc3c14d59790cf815d8bd1eda9b692348991e9754c0648cfbcb64789b6e6c4fef) |
| H1 | EITHER | MATCH · MATCH · DIFFER · DIFFER · ABSENT · ABSENT | held out | [`0x69aa9104…7ac730`](https://explorer-studio-dev.genlayer.com/tx/0x69aa910402687d98d38482cb42545e716c44440c3808eb15c6ad4a7f8a7ac730) |
| H2 | EITHER | DIFFER · MATCH · MATCH · DIFFER · ABSENT · ABSENT | held out | [`0x40b6c388…986ced`](https://explorer-studio-dev.genlayer.com/tx/0x40b6c388200b5bf8c6a8c904d381dc054744313ba2ae7a02f491a9c83f986ced) |
| H3 | EITHER | MATCH · DIFFER · MATCH · MATCH · ABSENT · ABSENT | held out | [`0x168f34a5…1590e9`](https://explorer-studio-dev.genlayer.com/tx/0x168f34a5da7b9ca89319238cde56f654169d9fa7ca4499a0db7e3791341590e9) |

## The reviewer's path through the site's signing code (page #21)

Fresh accounts, Studio faucet, every write through `web/lib/chain.ts`. Refusals are on chain on purpose.

- open the page with a 20 GEN deposit: [`0x825ce6d1…ac9eac`](https://explorer-studio-dev.genlayer.com/tx/0x825ce6d1b94f5cecb37b3196cbd7d12aa775bb842e31decf7d2d4da713ac9eac)
- a stranger tries to join: [`0x8b23a1be…ce72a1`](https://explorer-studio-dev.genlayer.com/tx/0x8b23a1beace0e3c2efd5efa2037abd757f533736521ea9e7f760ee376dce72a1) refused: "only the named counterparty can join"
- sera joins with the same deposit: [`0x082d1ad5…376e84`](https://explorer-studio-dev.genlayer.com/tx/0x082d1ad59dbde1dbc2ae05e47f79cb77c317b9cd6faaa546d997e06dbc376e84)
- kiln seals round 1: [`0xe9b32b5e…a10e65`](https://explorer-studio-dev.genlayer.com/tx/0xe9b32b5eeb4faf4be75a80b0865f128cb04dd04ccde8bbd0370350740fa10e65)
- sera tries to open before both sealed: [`0xc8534b41…675ec5`](https://explorer-studio-dev.genlayer.com/tx/0xc8534b4155e57ee33b9550622e6eddd292838504adc06d476af4d2d43f675ec5) refused: "accounts open only after both sides have sealed"
- sera seals round 1: [`0x797da1de…99946c`](https://explorer-studio-dev.genlayer.com/tx/0x797da1dec2b0c5ef84a971c9246af9ffca076aab259552a82b6e182e2f99946c)
- kiln tries to open a different text: [`0x134e6f4f…75eead`](https://explorer-studio-dev.genlayer.com/tx/0x134e6f4f5f52477aa2545892fc3dc76f01e5476654a0bc9ead3e8daeea75eead) refused: "this account does not match your seal"
- kiln opens round 1: [`0x675899c6…275161`](https://explorer-studio-dev.genlayer.com/tx/0x675899c6baf0ec0340011dea6de6fd1cb15ead07399b7e5fa8a47c8d36275161)
- sera opens round 1: [`0xf4142bb3…9f03d7`](https://explorer-studio-dev.genlayer.com/tx/0xf4142bb3f6650d8e6303a62e24418648261388ebabe112a7958fab143a9f03d7)
- the stranger runs the check, round 1: [`0x7e0fb160…f5525e`](https://explorer-studio-dev.genlayer.com/tx/0x7e0fb160be9d077e0ffef9a098681172202ac0b914cc0a851890bde7b1f5525e)
- kiln seals round 2: [`0xe67eb1b5…a581bc`](https://explorer-studio-dev.genlayer.com/tx/0xe67eb1b5bdb411b2e162c0f0cb89ba585181a687d4059e617e89deb7fea581bc)
- sera seals round 2: [`0xb3a986fd…8029e3`](https://explorer-studio-dev.genlayer.com/tx/0xb3a986fd67bb284f631c0898e0dc7fb7681b271280082cb04e660592818029e3)
- kiln opens round 2: [`0xa99a5ff9…37c888`](https://explorer-studio-dev.genlayer.com/tx/0xa99a5ff95949dd6d316b88fee733cdd0d63302dabf81a2c3f294743f6837c888)
- sera opens round 2: [`0x34dceaea…f4ee1a`](https://explorer-studio-dev.genlayer.com/tx/0x34dceaea89a1d090e0b2e3a6d47bb3874a407354fbd2aff1505c650a08f4ee1a)
- kiln runs the check, round 2: [`0xd67ff7b4…04be6e`](https://explorer-studio-dev.genlayer.com/tx/0xd67ff7b4de606293185a086a69482b52b03c6e3cb7a98628c7f121225d04be6e)
- the stranger tries to sign: [`0x65f9bd9f…66a2e0`](https://explorer-studio-dev.genlayer.com/tx/0x65f9bd9f21b20339c2623c78d576a66b31b6ba1b9d8425c11bd33b256066a2e0) refused: "not a side of this page"
- kiln signs: [`0x27faba54…50e66e`](https://explorer-studio-dev.genlayer.com/tx/0x27faba54eb61808f9baaa1e8c27cd71e503071715450259835acd24de550e66e)
- sera signs: [`0xda239605…41db28`](https://explorer-studio-dev.genlayer.com/tx/0xda2396056a8d5f5ee3ec95f6ae819c640462e563e0dffd7b59d7f8913641db28)
- kiln withdraws: [`0x191e7c37…dea5fe`](https://explorer-studio-dev.genlayer.com/tx/0x191e7c37178d974cfeaba10eab88429d6b24aa55fd2da65799f9f69afadea5fe)
- sera withdraws: [`0x67f404e6…41b890`](https://explorer-studio-dev.genlayer.com/tx/0x67f404e690de3c68ef448689a61e98bc408b6d94cd4839706e268b92ee41b890)
- kiln tries to withdraw twice: [`0x9f0cb382…8aeee0`](https://explorer-studio-dev.genlayer.com/tx/0x9f0cb3824bd7eaa28d8b2a92f92f8474962ac2f60261d1d4725f171a578aeee0) refused: "nothing to withdraw"
- kiln withdraw: the contract paid out 20 GEN of 20 owed, exact to the wei
- sera withdraw: the contract paid out 20 GEN of 20 owed, exact to the wei

## The full loop in a real browser (page #22)

Two Playwright browser contexts with stand-in wallets signing through `window.ethereum`; round 1 came back SAME PAGE. Screenshots: `chain/out/screens/`.

- kiln: opens a page from /new: [`0x2102f91a…1a7290`](https://explorer-studio-dev.genlayer.com/tx/0x2102f91a89fb26ecce70894788caf240f4debf18ba26ea12460779a49c1a7290)
- sera: joins from the link: [`0x2e929aeb…8d2736`](https://explorer-studio-dev.genlayer.com/tx/0x2e929aebcd706fd02c4cb58839cb5c7ec5aacfa7c54ee0421a136912a88d2736)
- kiln: writes and seals round 1: [`0x3789fc41…c7b166`](https://explorer-studio-dev.genlayer.com/tx/0x3789fc419108e57a01a0dd20e24654167be6efdb0be545c59714777681c7b166)
- sera: writes and seals round 1: [`0xa8e2a700…e694bb`](https://explorer-studio-dev.genlayer.com/tx/0xa8e2a7009d717a7e46aa16d1023b0009346a15ae6b901022d1e06eb90de694bb)
- kiln: opens their account: [`0x73c3ee64…e0f55c`](https://explorer-studio-dev.genlayer.com/tx/0x73c3ee64b52e101caf056e8fca8213e7ed3e0ec8a19fafc6a57aaa47ebe0f55c)
- sera: opens their account: [`0xd23342b5…7356af`](https://explorer-studio-dev.genlayer.com/tx/0xd23342b55a2cad3e233df0d101831e4cca497a84a371b9de1bff35cd557356af)
- kiln: runs the check: [`0xd91d456b…9e788c`](https://explorer-studio-dev.genlayer.com/tx/0xd91d456b59b9081785ca52c8d1b00612ad2183a4da6571674e1ebe6fb69e788c)
- kiln: signs: [`0x405d09aa…e94790`](https://explorer-studio-dev.genlayer.com/tx/0x405d09aa0579639bccedd09b9323048f4e8c8453ae7cb0e90385a59753e94790)
- sera: signs: [`0x20ad8382…e229ab`](https://explorer-studio-dev.genlayer.com/tx/0x20ad838269321de721a89e71b006422b6ab538624ef37ee94010f24001e229ab)
- kiln: reads the agreed record: [`0x405d09aa…e94790`](https://explorer-studio-dev.genlayer.com/tx/0x405d09aa0579639bccedd09b9323048f4e8c8453ae7cb0e90385a59753e94790)
- kiln: withdraws the deposit: [`0xdaebd662…f0626e`](https://explorer-studio-dev.genlayer.com/tx/0xdaebd66290907a869a17f2b70a9188a29ad193f7e14dbd6e4466087eccf0626e)
- sera: withdraws the deposit: [`0x9cbe5e71…b5d89b`](https://explorer-studio-dev.genlayer.com/tx/0x9cbe5e71554eea407aaa1f26e30c2a8b03bcb469d9464df718527b9229b5d89b)
- kiln: docs render: [`0xdaebd662…f0626e`](https://explorer-studio-dev.genlayer.com/tx/0xdaebd66290907a869a17f2b70a9188a29ad193f7e14dbd6e4466087eccf0626e)

## Seeded pages

- Page #18 (agreed in round 2): now AGREED
- Page #19 (left in round 2): now SEALING
- Page #20 (counterparty never seals): now SEALING
  - agreed.join: [`0xe1de293b…69bb0c`](https://explorer-studio-dev.genlayer.com/tx/0xe1de293b23882eb254f394bb459c1a087fdc95ff139f75766e0d566a4469bb0c)
  - agreed.open_page: [`0x84ceb3d0…4e68b7`](https://explorer-studio-dev.genlayer.com/tx/0x84ceb3d05bbf9fcc2a58092cd62bc29ae857f94f251c7d77fd6cf078554e68b7)
  - agreed.r1.check: [`0xf49ce862…46cf4d`](https://explorer-studio-dev.genlayer.com/tx/0xf49ce86255d200d05bde5784ab16ca2ab174b61e17d03a531652ec066746cf4d)
  - agreed.r1.reveal_a: [`0x7506819d…b41ec9`](https://explorer-studio-dev.genlayer.com/tx/0x7506819deb5b8412504924ab333390122a5dc3c45d20cba6fbe1d89242b41ec9)
  - agreed.r1.reveal_b: [`0x72643d58…c8e333`](https://explorer-studio-dev.genlayer.com/tx/0x72643d58dd1baf536a37562692f8a1efcb818e44c735d85f9264812bd7c8e333)
  - agreed.r1.seal_a: [`0x583b9775…492ccc`](https://explorer-studio-dev.genlayer.com/tx/0x583b977508c9f80791a4bb156026a765c071734f2c33289fa19db0a35c492ccc)
  - agreed.r1.seal_b: [`0x612fd62d…a5d51c`](https://explorer-studio-dev.genlayer.com/tx/0x612fd62d0f6c2789f5e194a00cf8ed5922bf66f43fbb6931561535e103a5d51c)
  - agreed.r2.check: [`0x65acea3b…3f0e07`](https://explorer-studio-dev.genlayer.com/tx/0x65acea3b54215b398a275aa863013834145aee14c3ae0ee34abe4a7e013f0e07)
  - agreed.r2.reveal_a: [`0x16991ff5…26cfb7`](https://explorer-studio-dev.genlayer.com/tx/0x16991ff588d6f33754b1934f65d83c7d6b668d28cc0eb45ff7274cd8ce26cfb7)
  - agreed.r2.reveal_b: [`0x69bcf56b…812f37`](https://explorer-studio-dev.genlayer.com/tx/0x69bcf56b615ae67c2d0a1858780d9ce0601d8055c40887e28f3a1d52c9812f37)
  - agreed.r2.seal_a: [`0xa8a3aea1…8995b0`](https://explorer-studio-dev.genlayer.com/tx/0xa8a3aea1b89a7d0e9690b3200ff550bfd723b2d89c2c10dd14e03f05168995b0)
  - agreed.r2.seal_b: [`0xb3e35374…65b570`](https://explorer-studio-dev.genlayer.com/tx/0xb3e35374fb501300a8fac0e85e470223fa036a80d63c32c6342625e0c365b570)
  - agreed.sign.kiln: [`0x91c0e215…5c7097`](https://explorer-studio-dev.genlayer.com/tx/0x91c0e215e147021740810f36e18b220c4763ffbf87861614d284a4b8785c7097)
  - agreed.sign.sera: [`0xfb838586…df026c`](https://explorer-studio-dev.genlayer.com/tx/0xfb8385863a33bb5ddb633ffaf014e86dde18890d3ad0e5c742403e6634df026c)
  - agreed.withdraw.kiln: [`0x908a79ce…18a8ae`](https://explorer-studio-dev.genlayer.com/tx/0x908a79ce0459b80ec4df34cc6eb476eb44cc9787b2ce0839dada99a2ad18a8ae)
  - agreed.withdraw.sera: [`0x6ecf1101…f3364e`](https://explorer-studio-dev.genlayer.com/tx/0x6ecf11010cee4b8d29437a7b62f4e9e0c9d0b4d0889927b92aaa8aee09f3364e)
  - noshow.join: [`0x94ffced0…cee804`](https://explorer-studio-dev.genlayer.com/tx/0x94ffced0a3e62d923869f76293d0cfdaaace84cba87ffb32b1febb208fcee804)
  - noshow.open_page: [`0xc5fa25c4…b95a65`](https://explorer-studio-dev.genlayer.com/tx/0xc5fa25c4aef12c50ac22719a12c69e911e1a05f489923e40929abfbeecb95a65)
  - noshow.seal.kiln: [`0x8f13b735…b70e1d`](https://explorer-studio-dev.genlayer.com/tx/0x8f13b7352f4ffb6d66cf66195fa0524e564b9feb27b56f16f4a94ad6fab70e1d)
  - round2.join: [`0x451c52ee…8870f4`](https://explorer-studio-dev.genlayer.com/tx/0x451c52ee74cd5c2f92414d1915f8bac151d77f8784118444a26047c48f8870f4)
  - round2.open_page: [`0xc437703d…c96f0b`](https://explorer-studio-dev.genlayer.com/tx/0xc437703d80d674b3f766c20c4ddda2da49832200a01109037bed3988c2c96f0b)
  - round2.r1.check: [`0x76ed254d…307fe1`](https://explorer-studio-dev.genlayer.com/tx/0x76ed254d676cc670015c5d7d23e04f16a253852e12156a92cea300002a307fe1)
  - round2.r1.reveal_a: [`0xcb371d9d…1179da`](https://explorer-studio-dev.genlayer.com/tx/0xcb371d9dfbb41956d28bff5861c18e61a44a2af6364b3118c37cf57fde1179da)
  - round2.r1.reveal_b: [`0x6be5b8a1…1f281e`](https://explorer-studio-dev.genlayer.com/tx/0x6be5b8a15a72aaa99d144a168a9834c0cbfa1307e97ac67f2a4fbad6361f281e)
  - round2.r1.seal_a: [`0xd79bb41e…6d2e05`](https://explorer-studio-dev.genlayer.com/tx/0xd79bb41e7318270a841263bda1e236367102420c7b60a2a7ed6473241e6d2e05)
  - round2.r1.seal_b: [`0xdd87cb8b…b8c262`](https://explorer-studio-dev.genlayer.com/tx/0xdd87cb8bbaf98f1c59c1dd8daba517f54dc6f0c5988f586de10b987918b8c262)

## Balances read back after finality (2026-10-19T01:41:54Z)

- `0x71b8DddE7A4bF0338dA4a652A387dD6805B8Ce49`: wallet 99.999323 GEN, in Samepage 0.000000 GEN
- `0xdcB849f078915713f89005aEA474E0A93B3D6F25`: wallet 99.999164 GEN, in Samepage 0.000000 GEN
