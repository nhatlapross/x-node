---
title: Function: armageddon()
slug: api/function-armageddon
createdAt: 2025-11-21T10:56:35.129Z
updatedAt: 2025-11-26T17:38:55.127Z
---

[**@xandeum/web3.js**](docId\:WXgxPNPIdcz6-2b6gH786)

***

[**Xandeum Web3 Library v1.12.0**](docId\:l2rwyC57Gjg6S93MCecr9) / armageddon

:::BlockQuote
**armageddon**(`fsid`, `wallet`): `Promise`\<`Transaction`>
:::

Defined in: [**armageddon.ts:13**](https://github.com/Xandeum/xandeum-web3.js/blob/master/src/armageddon.ts#L13)

Constructs a Solana transaction that triggers the "armageddon" instruction
on the specified file system (fsid).

## Parameters

### fsid

`string`

A stringified integer representing the file system ID to be used in the instruction.

### wallet

`PublicKey`

The public key of the wallet that will sign and authorize the transaction.

## Returns

`Promise`\<`Transaction`>

A Promise that resolves to a Solana `Transaction` object containing the armageddon instruction.