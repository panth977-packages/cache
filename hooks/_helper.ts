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
export abstract class Hook<Info, O extends z.ZodType> {
  private context_?: FUNCTIONS.Context;
  get context(): FUNCTIONS.Context | undefined {
    return this.context_;
  }
  constructor(context?: FUNCTIONS.Context) {
    this.context_ = context;
  }
  static updateContext<Info, O extends z.ZodType>(
    hook: Hook<Info, O>,
    context: FUNCTIONS.Context
  ) {
    hook.context_ = context;
  }
  abstract isIncomplete(arg: { info: Info }): boolean;
  abstract exists(arg: Record<never, never>): Promise<Info>;
  abstract get(arg: {
    safe?: boolean;
  }): Promise<{ val: z.infer<O>; info: Info }>;
  abstract set(arg: {
    output: SyncOrPromise<z.infer<O>>;
    ifExists?: boolean;
  }): Promise<void>;
  abstract del(arg: Record<never, never>): Promise<void>;
  abstract merge(arg: {
    target: z.infer<O>;
    extension: z.infer<O>;
  }): z.infer<O>;
}
