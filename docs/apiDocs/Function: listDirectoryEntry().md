---
title: Function: listDirectoryEntry()
slug: api/function-listdirectoryentry
createdAt: 2025-11-21T10:56:35.129Z
updatedAt: 2025-11-26T17:40:30.245Z
---

[**@xandeum/web3.js**](docId\:WXgxPNPIdcz6-2b6gH786)

***

[**Xandeum Web3 Library v1.12.0**](docId\:l2rwyC57Gjg6S93MCecr9) / listDirectoryEntry

:::BlockQuote
**listDirectoryEntry**(`connection`, `path`): `Promise`\<`any`>
:::

Defined in: [**listDirectoryEntery.ts:24**](https://github.com/Xandeum/xandeum-web3.js/blob/master/src/listDirectoryEntery.ts#L24)

Sends a JSON-RPC request to the Xandeum RPC endpoint to list all entries (files and subdirectories)
within a specified path.

This function calls the custom RPC method `listDirs`, which is  return an array of
directory entry metadata — names, types etc.

## Parameters

### connection

`Connection`

The solana web3 connection with Xandeum-compatible JSON-RPC endpoint (e.g., `'https://api.devnet.solana.com'`).

### path

`string`

The  filesystem path representing the directory to list (e.g., `/documents`).

## Returns

`Promise`\<`any`>

A `Promise<any>` resolving to the parsed JSON response from the RPC server,
typically including a `result` array containing directory entry objects.