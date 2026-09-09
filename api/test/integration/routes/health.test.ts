import { test } from 'node:test'
import * as assert from 'node:assert'
import { build } from '../../helper'

test('health check', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    url: 'api/health'
  })
  assert.deepStrictEqual(JSON.parse(res.payload), { ok: true })
})
