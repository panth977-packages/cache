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
  abstract exists(): Promise<Info>;
  abstract get(arg: {
    safe?: boolean;
  }): Promise<{ val: z.infer<S>; info: Info }>;
  abstract set(arg: {
    output: SyncOrPromise<z.infer<S>>;
    ifExists?: boolean;
  }): Promise<void>;
  abstract del(): Promise<void>;
  abstract merge(arg: {
    target: z.infer<S>;
    extension: z.infer<S>;
  }): z.infer<S>;
}
