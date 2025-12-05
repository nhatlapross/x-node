---
title: Function: bigbang()
slug: api/function-bigbang
createdAt: 2025-11-21T10:56:35.129Z
updatedAt: 2025-11-26T17:38:55.127Z
---

[**@xandeum/web3.js**](docId\:WXgxPNPIdcz6-2b6gH786)

***

[**Xandeum Web3 Library v1.12.0**](docId\:l2rwyC57Gjg6S93MCecr9) / bigbang

:::BlockQuote
**bigbang**(`wallet`): `Promise`\<`Transaction`>
:::

Defined in: [**bigbang.ts:10**](https://github.com/Xandeum/xandeum-web3.js/blob/master/src/bigbang.ts#L10)

Constructs a Solana transaction that triggers the "bigbang" instruction and create new file system.

## Parameters

### wallet

`PublicKey`

The public key of the wallet that will sign and authorize the transaction.

## Returns

`Promise`\<`Transaction`>

A Promise that resolves to a Solana `Transaction` object containing the bigbang instruction.