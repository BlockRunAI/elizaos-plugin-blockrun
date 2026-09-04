import {
  type Action,
  type ActionExample,
  type ActionResult,
  type HandlerCallback,
  type HandlerOptions,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
} from '@elizaos/core';
import { LLMClient, SolanaLLMClient, type ChatOptions } from '@blockrun/llm';
import { resolveBlockRunBilling, type BlockRunBillingConfig } from '../auth';

/**
 * BlockRun Chat Action - Account API or pay-per-request AI.
 *
 * Account billing is preferred when BLOCKRUN_API_KEY is configured. Wallet mode
 * prefers Solana and falls back to Base.
 */
type ChatClient = Pick<LLMClient, 'chat' | 'getWalletAddress'> | Pick<SolanaLLMClient, 'chat' | 'getWalletAddress'>;

class AccountChatClient {
  private readonly baseUrl: string;

  constructor(private readonly apiKey: string, apiUrl?: string) {
    const base = (apiUrl || 'https://api.blockrun.ai').replace(/\/+$/, '').replace(/\/v1$/, '');
    const parsed = new URL(base);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
      throw new Error('BLOCKRUN_API_BASE_URL must be a credential-free HTTPS origin.');
    }
    this.baseUrl = base;
  }

  async chat(model: string, prompt: string, options?: ChatOptions): Promise<string> {
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    if (options?.system) messages.push({ role: 'system', content: options.system });
    messages.push({ role: 'user', content: prompt });
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(120_000),
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: options?.maxTokens,
        temperature: options?.temperature,
      }),
    });
    if (!response.ok) {
      const raw = (await response.text()).split(this.apiKey).join('[REDACTED]').slice(0, 500);
      const hint = response.status === 402 ? ' Add credits at https://user.blockrun.ai/dashboard/credits.' : '';
      throw new Error(`BlockRun account API error ${response.status}.${hint} ${raw}`);
    }
    const body = await response.json().catch(() => {
      throw new Error('BlockRun account API returned invalid JSON.');
    }) as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('BlockRun account API returned no assistant content.');
    return content;
  }
}

type ResolvedChatClient = ChatClient | AccountChatClient;

function getClient(config: Exclude<BlockRunBillingConfig, { mode: 'none' }>): ResolvedChatClient {
  if (config.mode === 'account') {
    return new AccountChatClient(config.apiKey, config.apiUrl);
  }
  if (config.mode === 'solana') {
    return new SolanaLLMClient({ privateKey: config.privateKey, apiUrl: config.apiUrl });
  }
  return new LLMClient({ privateKey: config.privateKey, apiUrl: config.apiUrl });
}

export const blockrunChatAction: Action = {
  name: 'BLOCKRUN_CHAT',
  similes: ['BLOCKRUN_AI', 'ACCOUNT_API', 'PAY_PER_REQUEST', 'X402_CHAT', 'MICROPAY_AI'],
  description:
    'Call BlockRun with an account API key or automatic x402 USDC payment. ' +
    'Wallet mode prefers Solana and falls back to Base. ' +
    'Supports multiple AI providers: OpenAI (gpt-4o, gpt-4o-mini), Anthropic (claude-sonnet-4, claude-3.5-haiku), Google (gemini-2.0-flash), and more.',

  validate: async (runtime: IAgentRuntime): Promise<boolean> => {
    try {
      const billing = resolveBlockRunBilling(runtime);
      if (billing.mode === 'none') {
        logger.warn({
          src: 'plugin:blockrun:action:chat',
          agentId: runtime.agentId,
        }, 'BlockRun credentials not configured');
        return false;
      }

      return true;
    } catch (error) {
      logger.error({
        src: 'plugin:blockrun:action:chat',
        error: error instanceof Error ? error.message : String(error),
      }, 'Error validating BlockRun action');
      return false;
    }
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: HandlerOptions,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const startTime = Date.now();

    try {
      const billing = resolveBlockRunBilling(runtime);
      if (billing.mode === 'none') {
        throw new Error(
          'Set BLOCKRUN_API_KEY, SOLANA_WALLET_KEY, or BASE_CHAIN_WALLET_KEY. Create an account key at https://user.blockrun.ai/dashboard/keys.'
        );
      }
      const client = getClient(billing);

      // Extract the prompt from the message
      const prompt = message.content?.text || '';
      if (!prompt) {
        return {
          text: 'No prompt provided for BlockRun chat',
          values: { success: false, error: 'No prompt' },
          data: { actionName: 'BLOCKRUN_CHAT' },
          success: false,
        };
      }

      // Get model from options or use default
      const model = ((options as Record<string, unknown>)?.model as string) ||
        (runtime.getSetting('BLOCKRUN_DEFAULT_MODEL') as string) ||
        'openai/gpt-4o-mini';

      // Get system prompt from character or options
      const systemPrompt = (options as Record<string, unknown>)?.system as string ||
        runtime.character?.system ||
        undefined;

      // Build chat options
      const chatOptions: ChatOptions = {
        system: systemPrompt,
        maxTokens: (options as Record<string, unknown>)?.maxTokens as number || 1024,
        temperature: (options as Record<string, unknown>)?.temperature as number,
      };

      logger.info({
        src: 'plugin:blockrun:action:chat',
        agentId: runtime.agentId,
        model,
        promptLength: prompt.length,
      }, 'Making BlockRun API call');

      // Make the account-billed or pay-per-request call.
      const response = await client.chat(model, prompt, chatOptions);

      const latency = Date.now() - startTime;

      logger.info({
        src: 'plugin:blockrun:action:chat',
        agentId: runtime.agentId,
        model,
        responseLength: response.length,
        latencyMs: latency,
      }, 'BlockRun call completed');

      // Send response via callback if provided
      if (callback) {
        await callback({
          text: response,
          actions: ['BLOCKRUN_CHAT'],
        });
      }

      const walletAddress = billing.mode === 'account'
        ? undefined
        : await Promise.resolve((client as ChatClient).getWalletAddress());

      return {
        text: response,
        values: {
          success: true,
          model,
          responseLength: response.length,
          latencyMs: latency,
          billingMode: billing.mode,
          ...(walletAddress ? { walletAddress } : {}),
        },
        data: {
          actionName: 'BLOCKRUN_CHAT',
          model,
          billingMode: billing.mode,
          prompt,
          response,
          latencyMs: latency,
        },
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error({
        src: 'plugin:blockrun:action:chat',
        agentId: runtime.agentId,
        error: errorMessage,
      }, 'BlockRun chat failed');

      return {
        text: `BlockRun error: ${errorMessage}`,
        values: {
          success: false,
          error: errorMessage,
        },
        data: {
          actionName: 'BLOCKRUN_CHAT',
          error: errorMessage,
        },
        success: false,
        error: error instanceof Error ? error : new Error(errorMessage),
      };
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Ask BlockRun AI: What is the capital of France?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'The capital of France is Paris.',
          actions: ['BLOCKRUN_CHAT'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Use x402 to query: Explain smart contracts in one sentence.',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Smart contracts are self-executing programs on a blockchain that automatically enforce agreement terms when conditions are met.',
          actions: ['BLOCKRUN_CHAT'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Pay-per-request: Generate a haiku about crypto payments.',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Digital coins flow\nMicropayments stream like rain\nValue finds its way',
          actions: ['BLOCKRUN_CHAT'],
        },
      },
    ],
  ] as ActionExample[][],
};

export default blockrunChatAction;
