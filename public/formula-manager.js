// Formula CRUD, subscriptions and local persistence.
// Storage is injected so the same code runs in the browser, in tests and in a Worker.
import {
  calculateFormula, validateFormulaTree, describeTree, matchNumbers, nearMiss,
  POOL_SIZE, MAX_PREDICTIONS,
} from './formula-engine.js';

export const STORAGE_KEY = 'project1.formulas.v1';
export const KINDS = {
  bottom2: { id: 'bottom2', name: '2 ตัวล่าง', outputLength: 2, pool: POOL_SIZE[2] },
  top3: { id: 'top3', name: '3 ตัวบน', outputLength: 3, pool: POOL_SIZE[3] },
};

export function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: key => { data.delete(key); },
  };
}

function browserStorage() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch {
    // Access can throw in private mode; fall back to memory.
  }
  return memoryStorage();
}

export function normalizeFormula(input, now = new Date()) {
  const kind = Object.hasOwn(KINDS, input?.kind) ? input.kind : 'bottom2';
  const root = input?.root ?? input?.root_json;
  const error = validateFormulaTree(root);
  if (error) return { error };
  const stamp = now.toISOString();
  return {
    value: {
      id: typeof input?.id === 'string' && input.id ? input.id : `f_${stamp}_${Math.random().toString(36).slice(2, 7)}`,
      name: String(input?.name ?? '').trim().slice(0, 60) || 'สูตรไม่มีชื่อ',
      kind,
      outputLength: KINDS[kind].outputLength,
      root,
      description: describeTree(root),
      enabled: input?.enabled !== false,
      notifyOnMatch: input?.notifyOnMatch !== false,
      notifyOnNearMiss: input?.notifyOnNearMiss === true,
      version: Number(input?.version) || 1,
      createdAt: typeof input?.createdAt === 'string' ? input.createdAt : stamp,
      updatedAt: stamp,
    },
  };
}

export function createFormulaManager({ storage = browserStorage(), now = () => new Date() } = {}) {
  const read = () => {
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
      return {
        formulas: Array.isArray(parsed.formulas) ? parsed.formulas : [],
        subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
        profile: parsed.profile && typeof parsed.profile === 'object' ? parsed.profile : {},
      };
    } catch {
      return { formulas: [], subscriptions: [], profile: {} };
    }
  };
  const write = state => storage.setItem(STORAGE_KEY, JSON.stringify(state));

  const list = () => read().formulas;
  const subscriptions = () => read().subscriptions;
  const profile = () => read().profile;

  const get = id => list().find(item => item.id === id) ?? null;

  const save = input => {
    const normalized = normalizeFormula(input, now());
    if (normalized.error) return normalized;
    const state = read();
    const index = state.formulas.findIndex(item => item.id === normalized.value.id);
    if (index < 0) state.formulas.push(normalized.value);
    else state.formulas[index] = { ...state.formulas[index], ...normalized.value, createdAt: state.formulas[index].createdAt };
    write(state);
    return { value: get(normalized.value.id) };
  };

  const remove = id => {
    const state = read();
    const before = state.formulas.length;
    state.formulas = state.formulas.filter(item => item.id !== id);
    state.subscriptions = state.subscriptions.filter(item => item.formulaId !== id);
    write(state);
    return state.formulas.length < before;
  };

  const setEnabled = (id, enabled) => {
    const formula = get(id);
    if (!formula) return { error: 'ไม่พบสูตร' };
    return save({ ...formula, enabled: enabled !== false });
  };

  const setProfile = patch => {
    const state = read();
    state.profile = {
      birthDay: Number(patch?.birthDay) || state.profile.birthDay || 1,
      birthMonth: Number(patch?.birthMonth) || state.profile.birthMonth || 1,
      birthYear: Number(patch?.birthYear) || state.profile.birthYear || 2500,
    };
    write(state);
    return { value: state.profile };
  };

  const subscribe = (formulaId, options = {}) => {
    if (!get(formulaId)) return { error: 'ไม่พบสูตร' };
    const state = read();
    const existing = state.subscriptions.find(item => item.formulaId === formulaId);
    const value = {
      id: existing?.id ?? `s_${now().toISOString()}_${Math.random().toString(36).slice(2, 7)}`,
      formulaId,
      enabled: options.enabled !== false,
      notifyOnMatch: options.notifyOnMatch !== false,
      notifyOnNearMiss: options.notifyOnNearMiss === true,
      createdAt: existing?.createdAt ?? now().toISOString(),
    };
    if (existing) state.subscriptions[state.subscriptions.indexOf(existing)] = value;
    else state.subscriptions.push(value);
    write(state);
    return { value };
  };

  const unsubscribe = id => {
    const state = read();
    const before = state.subscriptions.length;
    state.subscriptions = state.subscriptions.filter(item => item.id !== id && item.formulaId !== id);
    write(state);
    return state.subscriptions.length < before;
  };

  // Evaluate every enabled formula against one context and report matches.
  const run = (context, actual = {}) => {
    const results = [];
    for (const formula of list()) {
      if (!formula.enabled) continue;
      const calculated = calculateFormula(formula, context);
      if (calculated.error) {
        results.push({ formulaId: formula.id, name: formula.name, error: calculated.error });
        continue;
      }
      const kind = KINDS[formula.kind] ?? KINDS.bottom2;
      const actualNumber = String(actual[kind.id] ?? '').replace(/\D/g, '');
      const match = actualNumber ? matchNumbers(calculated.numbers, actualNumber, kind.outputLength)
        : { matchType: null, matched: [] };
      const subscribed = subscriptions().some(item => item.formulaId === formula.id && item.enabled);
      results.push({
        formulaId: formula.id, name: formula.name, kind: formula.kind,
        value: calculated.value, numbers: calculated.numbers, description: calculated.description,
        actual: actualNumber || null, matchType: match.matchType, matched: match.matched,
        hit: match.matchType === 'exact', nearMiss: match.matchType === 'near',
        subscribed,
      });
    }
    return results;
  };

  const alertsFor = results => results
    .filter(result => subscriptions().some(subscription => subscription.enabled &&
      subscription.formulaId === result.formulaId &&
      ((result.hit && subscription.notifyOnMatch) || (result.nearMiss && subscription.notifyOnNearMiss))))
    .map(result => ({
      formulaId: result.formulaId,
      name: result.name,
      matchType: result.matchType,
      numbers: result.matched,
      actual: result.actual,
    }));

  return {
    list, get, save, remove, setEnabled, subscribe, unsubscribe, subscriptions,
    profile, setProfile, run, alertsFor,
  };
}

export { calculateFormula, matchNumbers, nearMiss, MAX_PREDICTIONS };
