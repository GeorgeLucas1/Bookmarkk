import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-120b:free';

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Client for the OpenRouter chat completions API, shared by the chat and the memory builder. */
@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);

  constructor(private readonly config: ConfigService) {}

  /** Throws a 503 when no API key is configured, so callers can fail before doing any work. */
  assertConfigured(): void {
    this.apiKey();
  }

  /** Returns the whole completion at once. */
  async complete(messages: ChatCompletionMessage[]): Promise<string> {
    const response = await this.request(messages, false);
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    return body.choices?.[0]?.message?.content ?? '';
  }

  /** Streams the completion token by token. */
  async *stream(messages: ChatCompletionMessage[]): AsyncGenerator<string> {
    const response = await this.request(messages, true);
    if (!response.body) {
      throw new ServiceUnavailableException('OpenRouter returned an empty stream');
    }

    const decoder = new TextDecoder();
    let buffered = '';

    for await (const value of response.body as unknown as AsyncIterable<Uint8Array>) {
      buffered += decoder.decode(value, { stream: true });

      let newlineIndex = buffered.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = buffered.slice(0, newlineIndex).trim();
        buffered = buffered.slice(newlineIndex + 1);
        newlineIndex = buffered.indexOf('\n');

        if (!line.startsWith('data:')) {
          continue;
        }
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          return;
        }
        try {
          const parsed = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            yield delta;
          }
        } catch {
          // Ignore malformed keep-alive lines from the upstream stream.
        }
      }
    }
  }

  private apiKey(): string {
    const apiKey = this.config.get<string>('OPENROUTER_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OPENROUTER_API_KEY is not configured. Set it in the .env file to enable chat.',
      );
    }
    return apiKey;
  }

  private async request(messages: ChatCompletionMessage[], stream: boolean): Promise<Response> {
    const model = this.config.get<string>('OPENROUTER_MODEL', DEFAULT_MODEL);

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, stream }),
    });

    if (response.status === 401 || response.status === 403) {
      throw new UnauthorizedException('OpenRouter rejected the API key. Check OPENROUTER_API_KEY.');
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.error(`OpenRouter request failed (${response.status}): ${detail}`);
      throw new ServiceUnavailableException(`OpenRouter request failed with status ${response.status}`);
    }
    return response;
  }
}
