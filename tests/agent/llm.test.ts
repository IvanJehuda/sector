import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createFakeLlm, createOpenAiLlm, LlmOutputError, type ChatParser } from '@/lib/agent/llm';

const Answer = z.object({ answer: z.string() });

interface ParseArgs {
  model: string;
  messages: Array<{ role: string; content: string }>;
  response_format: { type: string; json_schema: { name: string } };
}

function fakeOpenAi(parsed: unknown) {
  const parse = vi.fn(async (_args: ParseArgs) => ({ choices: [{ message: { parsed } }] }));
  const client = { chat: { completions: { parse } } } as unknown as ChatParser;
  return { parse, client };
}

describe('createOpenAiLlm', () => {
  it('sends model, messages and a named json_schema response format', async () => {
    const { parse, client } = fakeOpenAi({ answer: 'ok' });
    const llm = createOpenAiLlm({ apiKey: 'k', model: 'test-model', client });
    expect(await llm.parse({ schema: Answer, name: 'demo', system: 'S', user: 'U' })).toEqual({ answer: 'ok' });
    const args = parse.mock.calls[0][0];
    expect(args.model).toBe('test-model');
    expect(args.messages).toEqual([
      { role: 'system', content: 'S' },
      { role: 'user', content: 'U' },
    ]);
    expect(args.response_format.type).toBe('json_schema');
    expect(args.response_format.json_schema.name).toBe('demo');
  });

  it('throws LlmOutputError when nothing was parsed', async () => {
    const { client } = fakeOpenAi(null);
    const llm = createOpenAiLlm({ apiKey: 'k', model: 'm', client });
    await expect(llm.parse({ schema: Answer, name: 'demo', system: 'S', user: 'U' })).rejects.toBeInstanceOf(LlmOutputError);
  });
});

describe('createFakeLlm', () => {
  it('returns canned responses validated by the schema and records calls', async () => {
    const llm = createFakeLlm({ demo: { answer: 'hi' } });
    expect(await llm.parse({ schema: Answer, name: 'demo', system: 'S', user: 'U1' })).toEqual({ answer: 'hi' });
    expect(llm.calls).toEqual([{ name: 'demo', user: 'U1' }]);
  });

  it('supports function responses with a per-name call index', async () => {
    const llm = createFakeLlm({
      demo: (_user: string, i: number) => {
        if (i === 0) throw new Error('first call fails');
        return { answer: `call ${i}` };
      },
    });
    await expect(llm.parse({ schema: Answer, name: 'demo', system: 'S', user: 'U' })).rejects.toThrow('first call fails');
    expect(await llm.parse({ schema: Answer, name: 'demo', system: 'S', user: 'U' })).toEqual({ answer: 'call 1' });
  });

  it('rejects unknown names and schema-invalid responses', async () => {
    const llm = createFakeLlm({ demo: { wrong: true } });
    await expect(llm.parse({ schema: Answer, name: 'other', system: 'S', user: 'U' })).rejects.toBeInstanceOf(LlmOutputError);
    await expect(llm.parse({ schema: Answer, name: 'demo', system: 'S', user: 'U' })).rejects.toThrow();
  });
});
