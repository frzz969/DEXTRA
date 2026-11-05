# @dextra/api-client

Satu-satunya jembatan antara dashboard dan gateway MCP (JSON-RPC di `127.0.0.1:8765`).

```js
// browser
const api = window.DEXTRA_API.create({ baseUrl: 'http://127.0.0.1:8765', tokenKey: 'dextra_ops_token' });
api.call('get_caller_context', {}).then(ctx => console.log(ctx.scope));

// node / test
const { create, unwrap, envelope } = require('@dextra/api-client');
```

Tanpa dependensi. `unwrap()` dan `envelope()` dipisah dari `call()` supaya bisa diuji
tanpa server. Kalau `DEXTRA_API` tidak dimuat, `core.js` gagal keras alih-alih
diam-diam berperilaku lain.

Disalin ke `apps/dashboard/assets/js/api-client.js` oleh `node scripts/sync-packages.mjs`.

## Tes

```bash
node --test "packages/api-client/tests/*.test.js"
```
