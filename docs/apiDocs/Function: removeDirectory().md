---
title: Function: removeDirectory()
slug: api/function-removedirectory
createdAt: 2025-11-21T10:56:35.129Z
updatedAt: 2025-11-26T17:40:30.245Z
---

[**@xandeum/web3.js**](docId\:WXgxPNPIdcz6-2b6gH786)

***

[**Xandeum Web3 Library v1.12.0**](docId\:l2rwyC57Gjg6S93MCecr9) / removeDirectory

:::BlockQuote
**removeDirectory**(`fsid`, `path`, `wallet`): `Promise`\<`Transaction`>
:::

Defined in: [**removeDirectory.ts:17**](https://github.com/Xandeum/xandeum-web3.js/blob/master/src/removeDirectory.ts#L17)

Constructs a Solana transaction to perform a "remove directory" operation
in a  file system, identified by a file system ID (`fsid`).

## Parameters

### fsid

`string`

A stringified integer representing the file system ID containing the directory.

### path

`string`

The full path to the directory that should be removed.

### wallet

`PublicKey`

The public key of the wallet that will sign and authorize the transaction.

## Returns

`Promise`\<`Transaction`>

A Promise that resolves to a Solana `Transaction` object containing the remove directory instruction.

## Throws

May throw an error if the `path` fails validation in `sanitizePath`.