import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveBlockRunBilling } from '../dist/index.js';

const runtime = (settings = {}) => ({ getSetting: (name) => settings[name] });

test('account API key wins over both wallets', () => {
  const result = resolveBlockRunBilling(runtime({
    BLOCKRUN_API_KEY: 'brk_test',
    SOLANA_WALLET_KEY: 'solana-secret',
    BASE_CHAIN_WALLET_KEY: '0xbase',
  }), {});
  assert.deepEqual(result, { mode: 'account', apiKey: 'brk_test', apiUrl: undefined });
});

test('Solana wallet wins over Base wallet', () => {
  const result = resolveBlockRunBilling(runtime({
    SOLANA_WALLET_KEY: 'solana-secret',
    BASE_CHAIN_WALLET_KEY: '0xbase',
  }), {});
  assert.equal(result.mode, 'solana');
});

test('Base remains the wallet fallback', () => {
  const result = resolveBlockRunBilling(runtime(), { BASE_CHAIN_WALLET_KEY: '0xbase' });
  assert.equal(result.mode, 'base');
});

test('returns none when no credential is configured', () => {
  assert.deepEqual(resolveBlockRunBilling(runtime(), {}), { mode: 'none' });
});
