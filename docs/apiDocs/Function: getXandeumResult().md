---
title: Function: getXandeumResult()
slug: api/function-getxandeumresult
createdAt: 2025-11-21T10:56:35.130Z
updatedAt: 2025-11-26T17:40:49.890Z
---

[**@xandeum/web3.js**](docId\:WXgxPNPIdcz6-2b6gH786)

***

[**Xandeum Web3 Library v1.12.0**](docId\:l2rwyC57Gjg6S93MCecr9) / getXandeumResult

:::BlockQuote
**getXandeumResult**(`connection`, `signature`): `Promise`\<`any`>
:::

Defined in: [**getXandeumResult.ts:21**](https://github.com/Xandeum/xandeum-web3.js/blob/master/src/getXandeumResult.ts#L21)

Sends a JSON-RPC request to the Xandeum-compatible endpoint to retrieve
the result of a transaction previously submitted with a specific signature.

This function calls the custom RPC method `getXandeumResult`, which returns
the result associated with the given transaction signature.

## Parameters

### connection

`Connection`

The Solana web3 connection object pointing to a Xandeum-compatible RPC endpoint.

### signature

`string`

The transaction signature string whose result should be queried.

## Returns

`Promise`\<`any`>

A `Promise<any>` resolving to the parsed JSON response from the RPC server,
which includes the result of the transaction if available.