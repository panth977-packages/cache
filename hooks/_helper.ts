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
  readonly context: FUNCTIONS.Context;
  constructor(context: FUNCTIONS.Context) {
    this.context = context;
  }
  abstract isIncomplete(info: Info): boolean;
  abstract exists(): Promise<Info>;
  abstract get(safe?: boolean): Promise<{ val: z.infer<O>; info: Info }>;
  abstract set(
    output: SyncOrPromise<z.infer<O>>,
    ifExists?: boolean
  ): Promise<void>;
  abstract del(): Promise<void>;
  abstract merge(target: z.infer<O>, extension: z.infer<O>): z.infer<O>;
}
