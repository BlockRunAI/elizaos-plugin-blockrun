# @blockrun/elizaos-plugin

AI for ElizaOS agents through a BlockRun account API key or x402 USDC on Solana and Base.

## Overview

Use one BlockRun account API key across hosted models and product APIs, or keep pay-per-request wallet billing through the [x402 protocol](https://x402.org). Account billing is selected first, followed by Solana and then Base when more than one credential is configured.

**Supported Models:**
- OpenAI: gpt-4o, gpt-4o-mini
- Anthropic: claude-sonnet-4, claude-3.5-haiku
- Google: gemini-2.0-flash
- And more via BlockRun gateway

## Installation

```bash
npm install @blockrun/elizaos-plugin
# or
pnpm add @blockrun/elizaos-plugin
```

## Create an account API key

1. Register or sign in at [user.blockrun.ai](https://user.blockrun.ai).
2. Create a key in [Dashboard → Keys](https://user.blockrun.ai/dashboard/keys).
3. Add credits in [Dashboard → Credits](https://user.blockrun.ai/dashboard/credits).

```env
BLOCKRUN_API_KEY=brk_...
# Optional; the default is https://api.blockrun.ai
BLOCKRUN_API_BASE_URL=https://api.blockrun.ai
```

The account path uses bearer authentication and does not create or read a wallet.

## Wallet configuration

### Solana (preferred wallet path)

```env
SOLANA_WALLET_KEY=your_base58_secret_key
# Optional; the default is https://sol.blockrun.ai/api
BLOCKRUN_SOLANA_API_URL=https://sol.blockrun.ai/api
```

### Base fallback

Set your Base chain wallet private key:

```env
BASE_CHAIN_WALLET_KEY=0x...
```

Or in agent settings:

```typescript
const agent = new Agent({
  plugins: [blockrunPlugin],
  settings: {
    BLOCKRUN_API_KEY: 'brk_...',
  },
});
```

## Usage

### Plugin Registration

```typescript
import { blockrunPlugin } from '@blockrun/elizaos-plugin';

const agent = new Agent({
  plugins: [blockrunPlugin],
});
```

### Available Actions

#### BLOCKRUN_CHAT

Make a pay-per-request AI call:

```typescript
// The action is triggered when the agent needs to query an AI model
// Payments are handled automatically via x402
```

### Available Providers

#### BLOCKRUN_WALLET

Provides account or wallet billing context to the agent:

```typescript
// Account mode reports key/credits management links.
// Wallet mode reports Solana identity or Base balances.
```

## How It Works

1. The plugin checks for `BLOCKRUN_API_KEY`, then Solana, then Base credentials.
2. Account requests go to `https://api.blockrun.ai/v1` with bearer authentication.
3. Wallet requests receive an x402 quote and sign the required USDC payment locally.
4. The AI response is returned to the agent with its active billing mode.

Account charges appear in the BlockRun portal. Wallet payments use USDC on the selected chain.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `BLOCKRUN_API_KEY` | Account API key from the BlockRun portal | One credential required |
| `BLOCKRUN_API_BASE_URL` | Account API origin (default: `https://api.blockrun.ai`) | No |
| `SOLANA_WALLET_KEY` | Base58 Solana wallet secret key | One credential required |
| `BLOCKRUN_SOLANA_API_URL` | Solana gateway URL (default: `https://sol.blockrun.ai/api`) | No |
| `BASE_CHAIN_WALLET_KEY` | Base wallet private key | One credential required |
| `BLOCKRUN_API_URL` | Base gateway URL (default: `https://blockrun.ai/api`) | No |
| `BLOCKRUN_DEFAULT_MODEL` | Default model (default: openai/gpt-4o-mini) | No |

## Documentation

Full docs: **https://blockrun.ai/docs**

- ElizaOS integration guide: https://blockrun.ai/docs/frameworks/elizaos

## Links

- [BlockRun](https://blockrun.ai) - Pay-per-request AI gateway
- [x402 Protocol](https://x402.org) - HTTP 402 micropayment standard
- [ElizaOS](https://elizaos.ai) - AI agent framework

## License

MIT
