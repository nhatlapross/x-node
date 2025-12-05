---
title: Function: poke()
slug: api/function-poke
createdAt: 2025-11-21T10:56:35.130Z
updatedAt: 2025-11-26T17:40:41.259Z
---

[**@xandeum/web3.js**](docId\:WXgxPNPIdcz6-2b6gH786)

***

[**Xandeum Web3 Library v1.12.0**](docId\:l2rwyC57Gjg6S93MCecr9) / poke

:::BlockQuote
**poke**(`fsid`, `path`, `position`, `wallet`, `dataKey`): `Promise`\<`Transaction`>
:::

Defined in: [**poke.ts:19**](https://github.com/Xandeum/xandeum-web3.js/blob/master/src/poke.ts#L19)

Constructs a Solana transaction to perform a poke\operation, which writes data
to a file at the specified path and byte position.

## Parameters

### fsid

`string`

A stringified integer representing the file system ID where the file resides.

### path

`string`

The path to the file to be written to.

### position

`number`

The byte offset in the file where data should be written.

### wallet

`PublicKey`

The public key of the wallet that signs and authorizes the transaction.

### dataKey

`PublicKey`

A public key of a data account that holds the content to be written to the file.

## Returns

`Promise`\<`Transaction`>

A Promise that resolves to a Solana `Transaction` object containing the poke instruction.

## Throws

Will throw an error if the `path` contains invalid characters.