// deno-lint-ignore-file require-await
import { AbstractCacheClient, type AllFields, type KEY } from "./controller.ts";
import type { FUNCTIONS } from "@panth977/functions";

function time() {
  const start = Date.now();
  return function () {
    return Date.now() - start;
  };
}
/**
 * @example
 * ```ts
 * import { CACHE } from '@panth977/cache';
 * 
 * const cache = new CACHE.CacheController({
 *   client: new CACHE.MemoCacheClient(),
 *   allowed: {"*": true},
 *   defaultExpiry: 300000,
 *   log: false,
 *   prefix: '',
 *   separator: ':',
 * })
 * ```
 */
export class MemoCacheClient extends AbstractCacheClient {
  readonly memo: Record<
    KEY,
    Promise<unknown> | Record<string, Promise<unknown>>
  > = {};
  readonly exp: Record<KEY, ReturnType<typeof setTimeout>> = {};
  constructor() {
    super("Memo");
  }
  override async existsKey(
    context: FUNCTIONS.Context,
    key: KEY,
    log?: boolean
  ): Promise<boolean> {
    const timer = time();
    const keyValue = this.memo[key];
    const value =
      keyValue instanceof Promise
        ? keyValue.then((x) => x !== undefined)
        : false;
    if (log) {
      context.log(`(${timer()} ms) ${this.name}.exists(${key}) ✅`);
    }
    return value;
  }
  override async existsHashFields(
    context: FUNCTIONS.Context,
    key: KEY,
    fields: AllFields | KEY[],
    log?: boolean
  ): Promise<Record<string, boolean>> {
    const timer = time();
    const hashValue = this.memo[key];
    const value =
      hashValue instanceof Promise
        ? {}
        : fields === "*"
        ? Object.fromEntries(
            await Promise.all(
              Object.keys(hashValue).map(
                async (x) =>
                  [x, await hashValue[x].then((x) => x !== undefined)] as const
              )
            ).then((x) => x.filter((x) => x[1]))
          )
        : Object.fromEntries(
            await Promise.all(
              fields.map(
                async (x) =>
                  [x, await hashValue[x].then((x) => x !== undefined)] as const
              )
            )
          );
    if (log) {
      context.log(
        `(${timer()} ms) ${this.name}.exists(${key}, ${
          fields === "*" ? "*" : `[${fields}]`
        }) ✅`
      );
    }
    return value;
  }

  override async readKey<T>(
    context: FUNCTIONS.Context,
    key: KEY,
    log?: boolean
  ): Promise<T | undefined> {
    const timer = time();
    const keyValue = this.memo[key];
    const value = keyValue instanceof Promise ? await keyValue : undefined;
    if (log) {
      context.log(`(${timer()} ms) ${this.name}.read(${key}) ✅`);
    }
    return value as T | undefined;
  }
  override async readHashFields<T extends Record<string, unknown>>(
    context: FUNCTIONS.Context,
    key: KEY,
    fields: AllFields | KEY[],
    log?: boolean
  ): Promise<Partial<T>> {
    const timer = time();
    const hashValue = this.memo[key];
    const value =
      hashValue instanceof Promise
        ? {}
        : fields === "*"
        ? Object.fromEntries(
            await Promise.all(
              Object.keys(hashValue).map(
                async (x) => [x, await hashValue[x]] as const
              )
            )
          )
        : Object.fromEntries(
            await Promise.all(
              fields.map(async (x) => [x, await hashValue[x]] as const)
            )
          );
    if (log) {
      context.log(
        `(${timer()} ms) ${this.name}.read(${key}, ${
          fields === "*" ? "*" : `[${fields}]`
        }) ✅`
      );
    }
    for (const key in value) {
      if (value[key] === undefined) {
        delete value[key];
      }
    }
    return value as Partial<T>;
  }

  override async writeKey<T>(
    context: FUNCTIONS.Context,
    key: KEY,
    value: T | Promise<T>,
    expire: number,
    log?: boolean
  ): Promise<void> {
    const timer = time();
    if (key in this.exp) {
      clearTimeout(this.exp[key]);
      delete this.exp[key];
    }
    this.memo[key] = (
      value instanceof Promise ? value : Promise.resolve(value)
    ).catch(() => undefined);
    if (expire > 0) {
      this.exp[key] = setTimeout(() => {
        delete this.memo[key];
        delete this.exp[key];
      }, expire);
    }
    if (log) {
      context.log(`(${timer()} ms) ${this.name}.write(${key}) ✅`);
    }
  }
  override async writeHashFields<T extends Record<string, unknown>>(
    context: FUNCTIONS.Context,
    key: KEY,
    value: Promise<T> | { [k in keyof T]: Promise<T[k]> | T[k] },
    expire: number,
    log?: boolean
  ): Promise<void> {
    const timer = time();
    if (key in this.exp) {
      clearTimeout(this.exp[key]);
      delete this.exp[key];
    }
    const awaitedValue = value instanceof Promise ? await value : value;
    this.memo[key] = Object.fromEntries(
      Object.keys(awaitedValue).map((x) => [
        x,
        (awaitedValue[x] instanceof Promise
          ? awaitedValue[x]
          : Promise.resolve(awaitedValue[x])
        ).catch(() => undefined),
      ])
    );
    if (expire > 0) {
      this.exp[key] = setTimeout(() => {
        delete this.memo[key];
        delete this.exp[key];
      }, expire);
    }
    if (log) {
      context.log(
        `(${timer()} ms) ${this.name}.read(${key}, [${
          //
          Object.keys(awaitedValue)
        }]) ✅`
      );
    }
  }

  override async removeKey(
    context: FUNCTIONS.Context,
    key: KEY,
    log?: boolean
  ): Promise<void> {
    const timer = time();
    if (this.memo[key] instanceof Promise) {
      delete this.memo[key];
      if (key in this.exp) {
        clearTimeout(this.exp[key]);
        delete this.exp[key];
      }
    }
    if (log) {
      context.log(`(${timer()} ms) ${this.name}.remove(${key}) ✅`);
    }
  }
  override async removeHashFields(
    context: FUNCTIONS.Context,
    key: KEY,
    fields: AllFields | KEY[],
    log?: boolean
  ): Promise<void> {
    const timer = time();
    const hashValue = this.memo[key];
    if (hashValue instanceof Promise === false) {
      if (fields === "*") {
        delete this.memo[key];
        if (key in this.exp) {
          clearTimeout(this.exp[key]);
          delete this.exp[key];
        }
      } else if (hashValue) {
        for (const x of fields) {
          delete hashValue[x];
        }
      }
    }
    if (log) {
      context.log(
        `(${timer()} ms) ${this.name}.read(${key}, ${
          fields === "*" ? "*" : `[${fields}]`
        }) ✅`
      );
    }
  }
}
