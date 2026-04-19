# @hrkit/coach

AI coaching layer for [@hrkit](https://github.com/josedab/hrkit) — deterministic rule-engine summaries, pluggable LLM providers (OpenAI / Anthropic / Ollama), live in-workout cues, and adaptive workout recommenders.

## Install

```bash
npm install @hrkit/coach
```

## Quick Start — Deterministic rule engine

`ruleEngineSummary` is fully synchronous, has zero network dependencies, and is the safe default for offline / privacy-sensitive deployments.

```ts
import { ruleEngineSummary } from '@hrkit/coach';

const out = ruleEngineSummary({
  session,                 // a @hrkit/core Session
  baselineRmssd: 62.4,     // optional — enables recovery commentary
  recentTrimps: [70, 95, 110, 80], // optional — enables ACWR-aware advice
  userNote: 'felt sluggish on the warmup',
});

console.log(out.headline);        // notification-sized
console.log(out.summary);         // 3–6 sentence narrative
console.log(out.recommendations); // up to 5 short bullets
console.log(out.dominantZone);    // 1..5
console.log(out.analysis);        // numerical SessionAnalysis embedded
console.log(out.source);          // 'rule-engine'
```

## LLM-polished summaries

`generateCoachSummary` runs the rule engine first, then asks the provider to rewrite it in natural language. The rule output is the **fallback** — provider errors never throw, you always get a usable response.

```ts
import { generateCoachSummary, OpenAIProvider } from '@hrkit/coach';

const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o-mini',
});

const out = await generateCoachSummary({ session }, provider);
console.log(out.source); // 'openai' on success, 'rule-engine' on fallback
```

Built-in providers (all implement the same `LLMProvider` interface):

| Provider | Class | Notes |
|----------|-------|-------|
| OpenAI | `OpenAIProvider` | Configurable `baseUrl` for Azure / proxies |
| Anthropic | `AnthropicProvider` | Uses `messages` API |
| Ollama (local) | `OllamaProvider` | Defaults to `http://localhost:11434` |

All providers accept a custom `fetch` for testing or runtime injection (Bun, Cloudflare Workers, Deno):

```ts
new OpenAIProvider({ apiKey: '...', fetch: customFetch });
```

To bring your own LLM, implement `LLMProvider`:

```ts
import type { LLMProvider } from '@hrkit/coach';

const myProvider: LLMProvider = {
  name: 'my-llm',
  async complete({ system, user }) { /* ... */ return '...'; },
};
```

## Live in-workout cues

`liveCue` returns a single coaching string when the athlete drifts off target — or `null` to indicate "you're on target, stay quiet."

```ts
import { liveCue } from '@hrkit/coach';

const cue = liveCue(hr, /* targetZone */ 3, { maxHR: 190 });
if (cue) showToast(cue); // 'Ease back…' or 'Push it…'
```

## Adaptive workout recommenders

Three deterministic strategies ship out-of-the-box. They share a small `RecommenderPort` contract so you can swap between them — or wrap an LLM behind the same interface.

```ts
import {
  recoveryFirstRecommender,
  performanceRecommender,
  polarisedRecommender,
  evalRecommender,
  type RecommenderPort,
  type WorkoutRecommendation,
} from '@hrkit/coach';

const rec: WorkoutRecommendation = recoveryFirstRecommender.recommend({
  session: yesterdaysSession,
  baselineRmssd: 62.4,
  recentTrimps: [70, 95, 110, 80],
});
// { workout: 'recovery', durationMin: 30, targetZone: 1, confidence: 0.7, rationale: '...' }
```

`evalRecommender` runs a strategy against labelled cases and reports accuracy — useful for regression-testing a custom recommender:

```ts
const result = evalRecommender(myRecommender, [
  { input: {...}, acceptable: ['rest', 'recovery'] },
  { input: {...}, acceptable: ['interval'] },
]);
// { total, correct, accuracy, perCase: [...] }
```

## Convenience re-exports

- `sessionRmssd(rrIntervalsMs[])` — re-export of `@hrkit/core`'s `rmssd` so consumers building their own coach don't have to add a second dependency.

## Docs

See the [API reference](https://josedab.github.io/hrkit/api/coach/) and the [main README](../../README.md) for the full integrator guide.

## License

MIT
