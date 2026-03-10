import type { F } from "@panth977/functions";
import { type AllFields, CacheController, type KEY } from "./controller.ts";
import type { T } from "@panth977/tools";

/**
 * @example
 * ```ts
 * import { CACHE } from '@panth977/cache';
 *
 * const cache = new CACHE.CacheController({
 *   client: new CACHE.SafeCacheClient(new CACHE.MemoCacheClient()),
 *   allowed: {"*": true},
 *   defaultExpiry: 300000,
 *   log: false,
 *   prefix: '',
 *   separator: ':',
 * })
 * ```
 */
export class SafeCacheClient<C extends CacheController> extends CacheController {
  override existsKey(context: F.Context, opt: { key?: KEY }): T.PPromise<boolean> {
    const start = Date.now();
    return this.cache.existsKey(context, opt).$then((data) => {
      if (this.log) {
        context.logDebug(`${this.name}.exists(${this._getKey(opt.key)})`, `${Date.now() - start} ms`);
      }
      return data;
    }, (err) => {
      this.onError(context, err);
      return false;
    });
  }
  override existsHashFields(context: F.Context, opt: { key?: KEY; fields: Array<KEY> | AllFields }): T.PPromise<Record<string, boolean>> {
    const start = Date.now();
    return this.cache.existsHashFields(context, opt).$then((data) => {
      if (this.log) {
        context.logDebug(`${this.name}.exists(${this._getKey(opt.key)}, [${opt.fields}])`, `${Date.now() - start} ms`);
      }
      return data;
    }, (err) => {
      this.onError(context, err);
      return {};
    });
  }
  override readKey<T>(context: F.Context, opt: { key?: KEY }): T.PPromise<T | undefined> {
    const start = Date.now();
    return this.cache.readKey(context, opt).$then((data) => {
      if (this.log) {
        context.logDebug(`${this.name}.read(${this._getKey(opt.key)})`, `${Date.now() - start} ms`);
      }
      return data;
    }, (err) => {
      this.onError(context, err);
      return undefined;
    }) as any;
  }
  override readHashFields<T extends Record<string, unknown>>(
    context: F.Context,
    opt: { key?: KEY; fields: KEY[] | AllFields },
  ): T.PPromise<Partial<T>> {
    const start = Date.now();
    return this.cache.readHashFields(context, opt).$then((data) => {
      if (this.log) {
        context.logDebug(`${this.name}.read(${this._getKey(opt.key)}, [${opt.fields}])`, `${Date.now() - start} ms`);
      }
      return data;
    }, (err) => {
      this.onError(context, err);
      return {};
    }) as any;
  }
  override writeKey<T>(context: F.Context, opt: { key?: KEY; value: T }): T.PPromise<void> {
    const start = Date.now();
    return this.cache.writeKey(context, opt).$then((data) => {
      if (this.log) {
        context.logDebug(`${this.name}.write(${this._getKey(opt.key)})`, `${Date.now() - start} ms`);
      }
      return data;
    }, (err) => {
      this.onError(context, err);
    });
  }
  override writeHashFields<T extends Record<string, unknown>>(context: F.Context, opt: { key?: KEY; value: T }): T.PPromise<void> {
    const start = Date.now();
    return this.cache.writeHashFields(context, opt).$then((data) => {
      if (this.log) {
        context.logDebug(`${this.name}.write(${this._getKey(opt.key)}, [${Object.keys(opt.value)}])`, `${Date.now() - start} ms`);
      }
      return data;
    }, (err) => {
      this.onError(context, err);
    });
  }
  override removeKey(context: F.Context, opt: { key?: KEY }): T.PPromise<void> {
    const start = Date.now();
    return this.cache.removeKey(context, opt).$then((data) => {
      if (this.log) {
        context.logMsg(`${this.name}.remove(${this._getKey(opt.key)})`, `${Date.now() - start} ms`);
      }
      return data;
    }, (err) => {
      this.onError(context, err);
    });
  }
  override removeHashFields(context: F.Context, opt: { key?: KEY; fields: KEY[] | AllFields }): T.PPromise<void> {
    const start = Date.now();
    return this.cache.removeHashFields(context, opt).$then((data) => {
      if (this.log) {
        context.logDebug(`${this.name}.remove(${this._getKey(opt.key)}, [${opt.fields}])`, `${Date.now() - start} ms`);
      }
      return data;
    }, (err) => {
      this.onError(context, err);
    });
  }
  override incrementKey(context: F.Context, opt: { key?: KEY; incrBy: number; maxLimit: number }): T.PPromise<{ allowed: boolean; value: number }> {
    const start = Date.now();
    return this.cache.incrementKey(context, opt).$then((data) => {
      if (this.log) {
        context.logDebug(`${this.name}.incr(${this._getKey(opt.key)}, [+${opt.incrBy}, <${opt.maxLimit}])`, `${Date.now() - start} ms`);
      }
      return data;
    }, (err) => {
      this.onError(context, err);
      return { allowed: true, value: 0 };
    });
  }
  override incrementHashField(
    context: F.Context,
    opt: { key?: KEY; field: KEY; incrBy: number; maxLimit: number },
  ): T.PPromise<{ allowed: boolean; value: number }> {
    const start = Date.now();
    return this.cache.incrementHashField(context, opt).$then((data) => {
      if (this.log) {
        context.logDebug(`${this.name}.incr(${this._getKey(opt.key)}, [${opt.field}, +${opt.incrBy}, <${opt.maxLimit}])`, `${Date.now() - start} ms`);
      }
      return data;
    }, (err) => {
      this.onError(context, err);
      return { allowed: true, value: 0 };
    });
  }
  override dispose(): void {
    this.cache.dispose();
  }
  override clone(): this {
    return new SafeCacheClient(this.cache.clone(), this.onError) as this;
  }
  constructor(readonly cache: C, protected onError: (context: F.Context, err: unknown) => void) {
    const { expiry, log, mode, name, prefix, separator } = CacheController.get(cache);
    super({ name: `Safe(${name})`, expiry, log, mode, prefix, separator });
  }
  protected override _getKey(key: string | number | null | undefined): string {
    return CacheController.getKey(this.cache, key);
  }
  override set(opt: { mode?: "read-write" | "readonly" | "writeonly" | "ignore"; expiry?: number; log?: boolean }): this {
    return new SafeCacheClient(this.cache.set(opt), this.onError) as this;
  }
  override addPrefix(...prefix: (string | number)[]): this {
    return new SafeCacheClient(this.cache.addPrefix(...prefix), this.onError) as this;
  }
  override canExeExists(): boolean {
    return this.cache.canExeExists();
  }
  override canExeRead(): boolean {
    return this.cache.canExeRead();
  }
  override canExeWrite(): boolean {
    return this.cache.canExeWrite();
  }
  override canExeRemove(): boolean {
    return this.cache.canExeRemove();
  }
  override canExeIncrement(): boolean {
    return this.cache.canExeIncrement();
  }
}
