import assert from 'node:assert/strict';
import test from 'node:test';
import { Keypair } from '@solana/web3.js';
import { blockrunChatAction, blockrunWalletProvider } from '../dist/index.js';

test('account action uses bearer auth without wallet payment headers', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'ACCOUNT_OK' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const settings = {
    BLOCKRUN_API_KEY: 'brk_test_fixture',
    BLOCKRUN_API_BASE_URL: 'https://api.blockrun.ai/v1',
  };
  const runtime = {
    agentId: 'test-agent',
    character: {},
    getSetting: (name) => settings[name],
  };
  const result = await blockrunChatAction.handler(runtime, { content: { text: 'hello' } });

  assert.equal(result.success, true);
  assert.equal(result.text, 'ACCOUNT_OK');
  assert.equal(result.values.billingMode, 'account');
  assert.equal('walletAddress' in result.values, false);
  assert.equal(captured.url, 'https://api.blockrun.ai/v1/chat/completions');
  const headers = new Headers(captured.init.headers);
  assert.equal(headers.get('authorization'), 'Bearer brk_test_fixture');
  assert.equal([...headers.keys()].some((name) => name.includes('payment')), false);
});

test('billing provider selects Solana before Base and derives its address locally', async () => {
  const keypair = Keypair.generate();
  const settings = {
    SOLANA_WALLET_KEY: JSON.stringify([...keypair.secretKey]),
    BASE_CHAIN_WALLET_KEY: '0x0000000000000000000000000000000000000000000000000000000000000001',
  };
  const runtime = {
    agentId: 'solana-agent',
    getSetting: (name) => settings[name],
  };

  const result = await blockrunWalletProvider.get(runtime, {});

  assert.equal(result.data.billingMode, 'solana');
  assert.equal(result.data.address, keypair.publicKey.toBase58());
  assert.equal(result.values.billingMode, 'Solana x402');
});

test('account credit errors are sanitized and never replayed as wallet payments', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    assert.equal(init.redirect, 'error');
    assert.ok(init.signal instanceof AbortSignal);
    return new Response('Rejected brk_test_fixture', {status:402});
  };
  const settings = {BLOCKRUN_API_KEY:'brk_test_fixture', BASE_CHAIN_WALLET_KEY:'not-a-wallet'};
  const runtime = {agentId:'test-agent',character:{},getSetting:name=>settings[name]};
  const result = await blockrunChatAction.handler(runtime,{content:{text:'hello'}});
  assert.equal(result.success,false);
  assert.match(result.text,/402/);
  assert.match(result.text,/dashboard\/credits/);
  assert.ok(!result.text.includes(settings.BLOCKRUN_API_KEY));
  assert.equal(calls,1);
});
