export { SDK_NAME, SDK_VERSION } from './version.js';
/**
 * Pluggable ML inference for @hrkit.
 *
 * The package's job is *not* to ship trained models — it's to provide a
 * stable contract (`InferencePort`) so application code can swap models
 * without changing call sites. Built-in models are deterministic analytical
 * baselines that match the I/O shape of future ML models.
 */

export interface InferencePort<I, O> {
  /** Stable, unique model identifier (e.g. "lactate-threshold-baseline"). */
  readonly modelId: string;
  /** Semver of the *model weights*, not the package. */
  readonly version: string;
  /** Modalities consumed (e.g. "hr", "hrv", "power"). */
  readonly modalities: readonly string[];
  /**
   * Models flagged as "research" must never be used for clinical decisions.
   * The registry surfaces this for consent UIs and audit logs.
   */
  readonly intendedUse?: 'research' | 'wellness' | 'clinical';
  /** Run inference. Implementations should be pure with respect to inputs. */
  predict(input: I): Promise<O>;
}

export interface ModelCard {
  modelId: string;
  version: string;
  modalities: readonly string[];
  intendedUse: 'research' | 'wellness' | 'clinical';
  description?: string;
  reference?: string;
}

/**
 * Version-pinned model registry. Pinning by exact version is intentional:
 * silently auto-upgrading an ML model is a recipe for hard-to-debug
 * regressions, especially inside a coaching loop.
 */
export class ModelRegistry {
  private readonly byKey = new Map<string, InferencePort<unknown, unknown>>();
  private readonly cards = new Map<string, ModelCard>();

  register<I, O>(model: InferencePort<I, O>, card?: Partial<Omit<ModelCard, 'modelId' | 'version'>>): void {
    const key = this.key(model.modelId, model.version);
    if (this.byKey.has(key)) {
      throw new Error(`ml: model ${key} already registered`);
    }
    this.byKey.set(key, model as InferencePort<unknown, unknown>);
    this.cards.set(key, {
      modelId: model.modelId,
      version: model.version,
      modalities: model.modalities,
      intendedUse: model.intendedUse ?? 'research',
      ...card,
    });
  }

  get<I, O>(modelId: string, version?: string): InferencePort<I, O> | undefined {
    if (version) {
      return this.byKey.get(this.key(modelId, version)) as InferencePort<I, O> | undefined;
    }
    const matches: Array<[string, InferencePort<unknown, unknown>]> = [];
    for (const [k, m] of this.byKey) {
      if (k.startsWith(`${modelId}@`)) matches.push([k, m]);
    }
    if (matches.length === 0) return undefined;
    matches.sort(([a], [b]) => semverCompare(a.split('@')[1] ?? '', b.split('@')[1] ?? ''));
    const last = matches[matches.length - 1];
    return last ? (last[1] as InferencePort<I, O>) : undefined;
  }

  cardList(): ModelCard[] {
    return Array.from(this.cards.values());
  }

  get size(): number {
    return this.byKey.size;
  }

  private key(id: string, version: string): string {
    return `${id}@${version}`;
  }
}

function semverCompare(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10));
  const pb = b.split('.').map((n) => Number.parseInt(n, 10));
  for (let i = 0; i < 3; i++) {
    const da = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (da !== 0) return da;
  }
  return 0;
}

export {
  type FatigueInput,
  type FatigueOutput,
  fatigueBaseline,
} from './models/fatigue-baseline.js';
export {
  type LactateInput,
  type LactateOutput,
  lactateThresholdBaseline,
} from './models/lactate-threshold-baseline.js';
