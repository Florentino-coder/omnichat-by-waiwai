# ChatWai Connect v1

ChatWai Connect lets agents look up a customer's orders and deposits from your store system while they reply in chat. ChatWai calls your API with signed requests. You build the endpoints below.

`v1` is read-only. Do not build endpoints that move money, change orders, or return credentials.

## Setup

1. In ChatWai, open **Settings > Integrations** and enter a name and your base URL, for example `https://api.example.com/chatwai`. The URL must use `https` and resolve to a public address.
2. Copy the **Key ID** and **Secret**. The secret is shown only once.
3. Store both in your system as secrets, and build the endpoints.
4. Click **Test connection**. Agents can search only after the test passes.

## Request signing

Every request has these headers:

| Header | Value |
|---|---|
| `X-ChatWai-Key-Id` | Your key ID, for example `ck_3f2a...` |
| `X-ChatWai-Timestamp` | Unix time in seconds |
| `X-ChatWai-Signature` | One or more values, for example `v1=<hex>` or `v1=<hex>,v1=<hex>` |

To verify a request:

1. Check that `X-ChatWai-Key-Id` matches your key ID.
2. Reject the request if the timestamp is more than 300 seconds from your clock.
3. Build the signing string, where `path_and_query` is the path and query exactly as received, and `body_sha256` is the lowercase hex SHA-256 of the body. All `v1` requests are `GET`, so the body is empty.

   ```
   {timestamp}.{METHOD}.{path_and_query}.{body_sha256}
   ```

4. Compute `HMAC-SHA256(secret, signing_string)` as lowercase hex.
5. Accept the request if **any** `v1=` value matches. Use a constant-time comparison.
6. Otherwise return `401`.

**The test fails if your system accepts a bad signature.** Without this check, anyone could read your customer data.

### Rotating the secret

After you click **Rotate secret**, ChatWai signs with both secrets for 24 hours. Update your system within that time. Because you accept any matching value, nothing breaks during the change.

### Node.js example

```js
const crypto = require('crypto');

const EMPTY_SHA256 = crypto.createHash('sha256').update('').digest('hex');

function verifyChatWai(req, keyId, secret) {
  const timestamp = req.headers['x-chatwai-timestamp'] || '';
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (req.headers['x-chatwai-key-id'] !== keyId || !(age <= 300)) return false;

  const payload = `${timestamp}.${req.method}.${req.originalUrl}.${EMPTY_SHA256}`;
  const expected = Buffer.from(
    crypto.createHmac('sha256', secret).update(payload).digest('hex')
  );
  return String(req.headers['x-chatwai-signature'] || '')
    .split(',')
    .map(value => Buffer.from(value.trim().replace(/^v1=/, '')))
    .some(
      actual =>
        actual.length === expected.length &&
        crypto.timingSafeEqual(actual, expected)
    );
}
```

### PHP example

```php
function verifyChatWai(string $keyId, string $secret): bool {
    $timestamp = $_SERVER['HTTP_X_CHATWAI_TIMESTAMP'] ?? '';
    if (($_SERVER['HTTP_X_CHATWAI_KEY_ID'] ?? '') !== $keyId) return false;
    if (!ctype_digit($timestamp) || abs(time() - (int) $timestamp) > 300) return false;

    $payload = implode('.', [
        $timestamp,
        $_SERVER['REQUEST_METHOD'],
        $_SERVER['REQUEST_URI'],
        hash('sha256', ''),
    ]);
    $expected = hash_hmac('sha256', $payload, $secret);

    foreach (explode(',', $_SERVER['HTTP_X_CHATWAI_SIGNATURE'] ?? '') as $value) {
        if (hash_equals($expected, preg_replace('/^v1=/', '', trim($value)))) return true;
    }
    return false;
}
```

## Endpoints

Paths are relative to your base URL. Successful responses use `200` and wrap the result in `data`.

### `GET /v1/health`

```json
{ "data": { "status": "ok" } }
```

### `GET /v1/customers/lookup?phone=0812345678`

The phone is sent as the agent typed it, so normalize the format. Return `{ "data": { "customers": [] } }` when nothing matches. ChatWai keeps up to 5 customers, each with up to 10 orders and 10 deposits. Return `400` if the phone is invalid.

```json
{
  "data": {
    "customers": [
      {
        "id": "u_123",
        "displayName": "somchai",
        "phoneMasked": "***5678",
        "emailMasked": "so***@example.com",
        "recentOrders": [
          {
            "orderNumber": "GT123456",
            "status": "completed",
            "paymentStatus": "paid",
            "total": 100,
            "currency": "THB",
            "createdAt": "2026-10-01T10:00:00.000Z",
            "items": [{ "name": "Diamonds 100", "quantity": 1 }]
          }
        ],
        "recentDeposits": [
          {
            "reference": "DEP123",
            "amount": 500,
            "currency": "THB",
            "status": "pending",
            "createdAt": "2026-10-02T10:00:00.000Z"
          }
        ]
      }
    ]
  }
}
```

### `GET /v1/orders/{orderNumber}`

Return `404` if the order does not exist.

```json
{
  "data": {
    "order": { "orderNumber": "GT123456", "status": "completed", "paymentStatus": "paid", "total": 100, "currency": "THB", "createdAt": "2026-10-01T10:00:00.000Z", "items": [] },
    "customer": { "id": "u_123", "displayName": "somchai", "phoneMasked": "***5678", "emailMasked": "so***@example.com" }
  }
}
```

`customer` may be `null`.

## Status codes

| Status | Meaning in ChatWai |
|---|---|
| `200` | Success |
| `400` | The agent's search was rejected |
| `401`, `403` | Signature rejected |
| `404` | Not found |
| `429` | Too many requests. Agents are asked to try again. |
| Anything else | System unavailable. ChatWai does not follow redirects. |

ChatWai waits up to 8 seconds and reads up to 1 MB per response.

## Data rules

- Return only the fields above. ChatWai discards anything else.
- Mask phone numbers and emails.
- Never return passwords, balances, game logins, delivered codes, or slip images.
- A phone number typed in chat does not prove who the customer is. Results are shown to agents only, with a reminder to verify identity. ChatWai does not send them to customers automatically in `v1`.
- Log access on your side, and rate limit by key ID. All agents call from ChatWai's servers, so do not limit by IP alone.

## Reserved for later versions

`POST {ChatWai}/v1/events` is planned for events such as a deposit being confirmed. It is not available yet.
