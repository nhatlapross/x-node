---
title: Function: removeFile()
slug: api/function-removefile
createdAt: 2025-11-21T10:56:35.129Z
updatedAt: 2025-11-26T17:39:21.362Z
---

[**@xandeum/web3.js**](docId\:WXgxPNPIdcz6-2b6gH786)

***

[**Xandeum Web3 Library v1.12.0**](docId\:l2rwyC57Gjg6S93MCecr9) / removeFile

:::BlockQuote
**removeFile**(`fsid`, `path`, `wallet`): `Promise`\<`Transaction`>
:::

Defined in: [**removeFile.ts:17**](https://github.com/Xandeum/xandeum-web3.js/blob/master/src/removeFile.ts#L17)

Constructs a Solana transaction to remove a file from a  file system,
identified by a file system ID (`fsid`) and a UTF-8 encoded file path.

## Parameters

### fsid

`string`

A stringified integer representing the file system ID in which the file resides.

### path

`string`

The full path to the file to be deleted.

### wallet

`PublicKey`

The public key of the wallet that signs and authorizes the transaction.

## Returns

`Promise`\<`Transaction`>

A Promise that resolves to a Solana `Transaction` object containing the remove file instruction.

## Throws

May throw an error if `path` is invalid per `sanitizePath`.