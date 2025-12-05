---
title: Function: copyPath()
slug: api/function-copypath
createdAt: 2025-11-21T10:56:35.129Z
updatedAt: 2025-11-26T17:39:21.362Z
---

[**@xandeum/web3.js**](docId\:WXgxPNPIdcz6-2b6gH786)

***

[**Xandeum Web3 Library v1.12.0**](docId\:l2rwyC57Gjg6S93MCecr9) / copyPath

:::BlockQuote
**copyPath**(`fsid`, `srcPath`, `destPath`, `wallet`): `Promise`\<`Transaction`>
:::

Defined in: [**copyPath.ts:18**](https://github.com/Xandeum/xandeum-web3.js/blob/master/src/copyPath.ts#L18)

Constructs a Solana transaction to copy a file or directory from one  path to another.

## Parameters

### fsid

`string`

The unique numeric identifier representing the target file system.

### srcPath

`string`

The source path to copy from (e.g., `/documents/report.txt`).

### destPath

`string`

The destination path to copy to (e.g., `/archive/report.txt`).

### wallet

`PublicKey`

The wallet public key used to sign and authorize the transaction.

## Returns

`Promise`\<`Transaction`>

A Promise that resolves to a Solana `Transaction` object containing the copyPath instruction.

## Throws

Will throw an error if `srcPath` or `destPath` contains invalid characters.