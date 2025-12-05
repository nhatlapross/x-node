---
title: Function: unsubscribeResult()
slug: api/function-unsubscriberesult
createdAt: 2025-11-21T10:56:35.130Z
updatedAt: 2025-11-26T17:40:55.941Z
---

[**@xandeum/web3.js**](docId\:WXgxPNPIdcz6-2b6gH786)

***

[**Xandeum Web3 Library v1.12.0**](docId\:l2rwyC57Gjg6S93MCecr9) / unsubscribeResult

:::BlockQuote
**unsubscribeResult**(`connection`, `subscriptionId`): `void`
:::

Defined in: [**webSocket.ts:103**](https://github.com/Xandeum/xandeum-web3.js/blob/master/src/webSocket.ts#L103)

Sends a WebSocket JSON-RPC message to unsubscribe from a previously subscribed transaction result
using the `xandeumResultUnsubscribed` method (note: custom method, ensure server-side implementation matches).

This function automatically closes the WebSocket connection after sending the unsubscribe request.

## Parameters

### connection

`Connection`

The solana web3 connection with Xandeum-compatible JSON-RPC endpoint (e.g., `'https://api.devnet.solana.com'`).

### subscriptionId

`string`

The ID of the active subscription you want to cancel.

## Returns

`void`