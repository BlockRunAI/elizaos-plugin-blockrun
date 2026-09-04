// Opt-in: BLOCKRUN_API_KEY=... npm run test:account-live (a small paid LLM call).
import assert from 'node:assert/strict';
import { blockrunChatAction, blockrunWalletProvider } from '../dist/index.js';
assert.ok(process.env.BLOCKRUN_API_KEY, 'Set BLOCKRUN_API_KEY in the environment.');
const runtime = {
  agentId: 'account-live-test', character: {},
  getSetting(name) { return name === 'BLOCKRUN_API_KEY' ? process.env.BLOCKRUN_API_KEY : undefined; },
};
const status = await blockrunWalletProvider.get(runtime, {});
assert.equal(status.data.billingMode, 'account');
assert.ok(!JSON.stringify(status).includes(process.env.BLOCKRUN_API_KEY));
let callbackText;
const result = await blockrunChatAction.handler(runtime, {content:{text:'Reply only OK'}}, undefined,
  {model:'openai/gpt-4.1-nano',maxTokens:16}, async response => { callbackText=response.text; });
assert.equal(result.success,true);
assert.equal(result.values.billingMode,'account');
assert.ok(result.text.length>0);
assert.equal(callbackText,result.text);
assert.equal('walletAddress' in result.values,false);
console.log(JSON.stringify({ok:true,billingMode:'account',callback:true,replyChars:result.text.length}));
