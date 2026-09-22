import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { ZodType } from 'zod';
import type { LlmClient } from '@/lib/domain';

export class LlmOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmOutputError';
  }
}

export type ChatParser = Pick<OpenAI, 'chat'>;

export function createOpenAiLlm(opts: { apiKey: string; model: string; client?: ChatParser }): LlmClient {
  const client = opts.client ?? new OpenAI({ apiKey: opts.apiKey });
  return {
    async parse<T>({ schema, name, system, user }: { schema: ZodType<T>; name: string; system: string; user: string }): Promise<T> {
      const completion = await client.chat.completions.parse({
        model: opts.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: zodResponseFormat(schema, name),
      });
      const parsed = completion.choices[0]?.message.parsed;
      if (parsed === null || parsed === undefined) throw new LlmOutputError(`LLM returned no parsed output for ${name}`);
      return parsed as T;
    },
  };
}

export type FakeResponse = unknown | ((user: string, callIndex: number) => unknown);

export function createFakeLlm(
  responses: Record<string, FakeResponse>,
): LlmClient & { calls: Array<{ name: string; user: string }> } {
  const calls: Array<{ name: string; user: string }> = [];
  return {
    calls,
    async parse<T>({ schema, name, user }: { schema: ZodType<T>; name: string; system: string; user: string }): Promise<T> {
      const callIndex = calls.filter((c) => c.name === name).length;
      calls.push({ name, user });
      if (!(name in responses)) throw new LlmOutputError(`No fake LLM response for "${name}"`);
      const r = responses[name];
      const value = typeof r === 'function' ? (r as (u: string, i: number) => unknown)(user, callIndex) : r;
      return schema.parse(value);
    },
  };
}
