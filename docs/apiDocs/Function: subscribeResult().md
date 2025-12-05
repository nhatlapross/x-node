---
title: Function: subscribeResult()
slug: api/function-subscriberesult
createdAt: 2025-11-21T10:56:35.130Z
updatedAt: 2025-11-26T17:40:55.941Z
---

[**@xandeum/web3.js**](docId\:WXgxPNPIdcz6-2b6gH786)

***

[**Xandeum Web3 Library v1.12.0**](docId\:l2rwyC57Gjg6S93MCecr9) / subscribeResult

:::BlockQuote
**subscribeResult**(`connection`, `tx`, `onResult`, `onError?`, `onClose?`): `void`
:::

Defined in: [**webSocket.ts:40**](https://github.com/Xandeum/xandeum-web3.js/blob/master/src/webSocket.ts#L40)

Opens a WebSocket connection and subscribes to the result of a transaction
via the custom `xandeumResultSubscribe` method.

This is useful for receiving asynchronous results tied to an on-chain operation,
such as file creation, modification, or deletion.

The subscription sends a JSON-RPC request with:

- `method`: "xandeumResultSubscribe"
- `params`: \[txId, \{ commitment: "finalized" }]

The WebSocket listens for result messages and invokes the `onResult` callback
if a valid result with `fsid`, `status`, or `data` is received.

## Parameters

### connection

`Connection`

The solana web3 connection with Xandeum-compatible JSON-RPC endpoint (e.g., `'https://api.devnet.solana.com'`).

### tx

`string`

The transaction ID you want to listen for results from.

### onResult

(`value`) => `void`

Callback to handle incoming result messages. Triggered when a valid response is received.

### onError?

(`err`) => `void`

(Optional) Callback triggered if a WebSocket error occurs.

### onClose?

() => `void`

(Optional) Callback triggered when the WebSocket connection closes.

## Returns

`void`