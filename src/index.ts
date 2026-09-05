/**
 * @blockrun/elizaos-plugin
 *
 * BlockRun account API and x402 pay-per-request AI plugin for ElizaOS.
 *
 * Configure an account API key, or pay per request with a Solana/Base wallet.
 *
 * Features:
 * - Pay-per-request AI access (OpenAI, Anthropic, Google, etc.)
 * - Account API billing with bearer authentication
 * - Automatic x402 micropayments on Solana or Base
 * - Billing context provider for agents
 *
 * Configuration:
 * Set BLOCKRUN_API_KEY, SOLANA_WALLET_KEY, or BASE_CHAIN_WALLET_KEY.
 *
 * @example
 * ```typescript
 * import { blockrunPlugin } from '@blockrun/elizaos-plugin';
 *
 * const agent = new Agent({
 *   plugins: [blockrunPlugin],
 *   settings: {
 *     BLOCKRUN_API_KEY: 'brk_...',
 *   },
 * });
 * ```
 *
 * @see https://blockrun.ai
 * @see https://x402.org
 */

import type { Plugin } from '@elizaos/core';
import { blockrunChatAction } from './actions/chat';
import { blockrunWalletProvider } from './providers/wallet';

// Re-export individual components
export * from './actions';
export * from './providers';
export { resolveBlockRunBilling, type BlockRunBillingConfig } from './auth';

/**
 * BlockRun Plugin for ElizaOS
 *
 * Enables account-billed or pay-per-request AI.
 */
export const blockrunPlugin: Plugin = {
  name: 'blockrun',
  description: 'AI through a BlockRun account API key or x402 USDC on Solana and Base. Access OpenAI, Anthropic, Google, and more.',
  actions: [blockrunChatAction],
  providers: [blockrunWalletProvider],
  evaluators: [],
  services: [],
};

export default blockrunPlugin;
