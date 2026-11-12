// @ts-nocheck
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import init, { validate, preview_order } from './pkg/worldworks_engine_wasm.js';
test('WASM matches native vending simulation', async () => {
  await init({ module_or_path: readFileSync(new URL('./pkg/worldworks_engine_wasm_bg.wasm', import.meta.url)) });
  const machine = JSON.parse(readFileSync(new URL('../../../engine/examples/vending.json', import.meta.url), 'utf8'));
  assert.equal(JSON.parse(validate(JSON.stringify(machine))).ok, true);
  const result = JSON.parse(preview_order(JSON.stringify(machine), machine.nodes.slot.price, '0x1111111111111111111111111111111111111111'));
  assert.deepEqual(result.effects, [
    { VaultCredit: { name: 'reserve', amount: '630000000000000000000000' } },
    { ExternalPayout: { recipient: '0x1111111111111111111111111111111111111111', wei: '1000000000000000', fee: '70000000000000000000000' } },
    { Payout: { account: 'creator.testnet', amount: '300000000000000000000000' } },
  ]);
  const native = execFileSync('cargo', ['run', '--quiet', '--manifest-path', '../engine/Cargo.toml', '--example', 'run', '--', '../engine/examples/vending.json'], { encoding: 'utf8', env: process.env });
  for (const effect of result.effects) {
    const [kind, fields] = Object.entries(effect)[0];
    const line = native.split('\n').find(line => line.startsWith(`Effect: ${kind} {`));
    assert.ok(line);
    for (const [k, v] of Object.entries(fields)) assert.ok(line.includes(`${k}: ${['amount','wei','fee'].includes(k) ? v : JSON.stringify(v)}`));
  }
  machine.nodes.fees.outputs[0].bps--;
  assert.ok(JSON.parse(validate(JSON.stringify(machine))).errors.some(e => e.InvalidSplitter === 'fees'));
});
