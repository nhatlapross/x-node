---
title: Function: renamePath()
slug: api/function-renamepath
createdAt: 2025-11-21T10:56:35.129Z
updatedAt: 2025-11-26T17:39:21.362Z
---

[**@xandeum/web3.js**](docId\:WXgxPNPIdcz6-2b6gH786)

***

[**Xandeum Web3 Library v1.12.0**](docId\:l2rwyC57Gjg6S93MCecr9) / renamePath

:::BlockQuote
**renamePath**(`fsid`, `oldPath`, `name`, `wallet`): `Promise`\<`Transaction`>
:::

Defined in: [**renamePath.ts:18**](https://github.com/Xandeum/xandeum-web3.js/blob/master/src/renamePath.ts#L18)

Constructs a Solana transaction to rename (or move) a file or directory
within a file system, based on a provided file system ID (`fsid`).

## Parameters

### fsid

`string`

A stringified integer representing the file system ID where the path exists.

### oldPath

`string`

The current path of the file or directory to be renamed or moved.

### name

`string`

The new name to assign to the file or directory.

### wallet

`PublicKey`

The public key of the wallet that signs and authorizes the transaction.

## Returns

`Promise`\<`Transaction`>

A Promise that resolves to a Solana `Transaction` object containing the rename path instruction.

## Throws

May throw an error if either `oldPath` or `newPath` is invalid per `sanitizePath`.