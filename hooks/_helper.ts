import type { FUNCTIONS } from "@panth977/functions";
import type { z } from "zod";
import type { KEY } from "../controller.ts";
export type zKEY = z.ZodType<KEY, any, any>;
export type SyncOrPromise<T> = Awaited<T> | Promise<Awaited<T>>;
export function bundleCached<V>(
  ids: KEY[],
  values: V[]
): Record<KEY, Exclude<V, undefined | null>> {
  const res: Record<KEY, V> = {} as never;
  for (let i = 0; i < ids.length; i++) {
    if (values[i] != null) {
      res[ids[i]] = values[i];
    }
  }
  return res as never;
}
export function extractFromPromise<T>(
  keys: KEY[],
  promise: Promise<Record<KEY, T>>
): Record<KEY, Promise<T>> {
  return Object.fromEntries(
    keys.map((k) => [k, promise.then((data) => data[k])])
  );
}
export abstract class Hook<Info, S extends z.ZodType = any> {
  private context_?: FUNCTIONS.Context;
  private schema_?: S;
  get context(): FUNCTIONS.Context | undefined {
    return this.context_;
  }
  get schema(): S | undefined {
    return this.schema_;
  }
  constructor(context?: FUNCTIONS.Context, schema?: S) {
    this.context_ = context;
    this.schema_ = schema;
  }
  static Wrap<I extends [] | [any, ...any[]], Info, O extends z.ZodType>(
    getHook: (...input: I) => Hook<Info, O>,
    func: (info: Info, ...input: I) => Promise<z.infer<O>>
  ): (...input: I) => Promise<z.infer<O>> {
    async function CacheFunc(...arg: I) {
      const hook = getHook(...arg);
      const result = await hook.get({ safe: !!hook.schema });
      if (hook.isIncomplete(result)) {
        const res = await func(result.info, ...arg);
        result.val = hook.merge({ target: result.val, extension: res });
        hook.set({ output: result.val });
      }
      return result.val;
    }
    return Object.assign(CacheFunc, getHook);
  }
  static updateContext<Info, O extends z.ZodType>(
    hook: Hook<Info, O>,
    context: FUNCTIONS.Context
  ): Hook<Info, O> {
    hook.context_ = context;
    return hook;
  }
  static updateSchema<Info, O extends z.ZodType>(
    hook: Hook<Info, any>,
    schema: O
  ): Hook<Info, O> {
    hook.schema_ = schema;
    return hook;
  }
  abstract isIncomplete(arg: { info: Info }): boolean;
  abstract exists(arg: Record<never, never>): Promise<Info>;
  abstract get(arg: {
    safe?: boolean;
  }): Promise<{ val: z.infer<S>; info: Info }>;
  abstract set(arg: {
    output: SyncOrPromise<z.infer<S>>;
    ifExists?: boolean;
  }): Promise<void>;
  abstract del(arg: Record<never, never>): Promise<void>;
  abstract merge(arg: {
    target: z.infer<S>;
    extension: z.infer<S>;
  }): z.infer<S>;
}
