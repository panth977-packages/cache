import type { F } from "@panth977/functions";
import { T } from "@panth977/tools";
import type { AllFields, CacheController, KEY } from "./controller.ts";

/**
 * wrappers for {@link AbstractCacheClient} to streamline the
 */
export class CacheApi<C extends CacheController = any> {
  constructor(
    readonly cache: C,
    readonly name: string,
    readonly separator: string,
    readonly prefix: string,
    readonly expiry: number,
    readonly mode: "read-write" | "readonly" | "writeonly" | "ignore",
    readonly log: boolean,
    protected onError: (context: F.Context, err: unknown) => void,
  ) {
    this.name = name;
    this.separator = separator;
    this.expiry = expiry;
    this.mode = mode;
    this.log = log;
  }
  protected _getKey(key: string | number | null | undefined): string {
    if (key === "" || key === null || key === undefined) return this.prefix;
    return `${this.prefix}${this.separator}${key}`;
  }
  /********************* Controllers *********************/
  existsKey(context: F.Context, opt: { key?: KEY }): T.PPromise<boolean> {
    const key = this._getKey(opt.key);
    if (!this.canExeExists()) {
      context.logDebug(`${this.name}.exists(${key})`, "Method not allowed");
      return T.PPromise.resolve(false) as any;
    }
    const start = Date.now();
    return this.cache.existsKey(context, { ...opt, key }).$then((data) => {
      if (this.log) {
        context.logDebug(`${this.name}.exists(${key})`, `${Date.now() - start} ms`);
      }
      return data;
    }, (err) => {
      this.onError(context, err);
      return false;
    });
  }
  existsHashFields(context: F.Context, opt: { key?: KEY; fields: Array<KEY> | AllFields }): T.PPromise<Record<string, boolean>> {
    const key = this._getKey(opt.key);
    if (!this.canExeExists()) {
      context.logDebug(`${this.name}.exists(${key}, [${opt.fields}])`, "Method not allowed");
      return T.PPromise.resolve({}) as any;
    }
    const start = Date.now();
    return this.cache.existsHashFields(context, { ...opt, key }).$then((data) => {
      if (this.log) {
        context.logDebug(`${this.name}.exists(${key}, [${opt.fields}])`, `${Date.now() - start} ms`);
      }
      return data;
    }, (err) => {
      this.onError(context, err);
      return {};
    });
  }
  readKey<T>(context: F.Context, opt: { key?: KEY }): T.PPromise<T | undefined> {
    const key = this._getKey(opt.key);
    if (!this.canExeRead()) {
      context.logDebug(`${this.name}.read(${key})`, "Method not allowed");
      return T.PPromise.resolve(undefined) as any;
    }
    const start = Date.now();
    return this.cache.readKey(context, { ...opt, key }).$then((data) => {
      if (this.log) {
        context.logDebug(`${this.name}.read(${key})`, `${Date.now() - start} ms`);
      }
      return data;
    }, (err) => {
      this.onError(context, err);
      return undefined;
    }) as any;
  }
  readHashFields<T extends Record<string, unknown>>(
    context: F.Context,
    opt: { key?: KEY; fields: KEY[] | AllFields },
  ): T.PPromise<Partial<T>> {
    const key = this._getKey(opt.key);
    if (!this.canExeRead()) {
      context.logDebug(`${this.name}.read(${key}, [${opt.fields}])`, "Method not allowed");
      return T.PPromise.resolve({}) as any;
    }
    const start = Date.now();
    return this.cache.readHashFields(context, { ...opt, key }).$then((data) => {
      if (this.log) {
        context.logDebug(`${this.name}.read(${key}, [${opt.fields}])`, `${Date.now() - start} ms`);
      }
      return data;
    }, (err) => {
      this.onError(context, err);
      return {};
    }) as any;
  }
  writeKey<T>(context: F.Context, opt: { key?: KEY; value: T; expiry?: number }): T.PPromise<void> {
    const key = this._getKey(opt.key);
    if (!this.canExeWrite()) {
      context.logDebug(`${this.name}.write(${key})`, "Method not allowed");
      return T.PPromise.resolve(void 0) as any;
    }
    const start = Date.now();
    return this.cache.writeKey(context, { ...opt, key, expiry: opt.expiry ?? this.expiry }).$then((data) => {
      if (this.log) {
        context.logDebug(`${this.name}.write(${key})`, `${Date.now() - start} ms`);
      }
      return data;
    }, (err) => {
      this.onError(context, err);
    });
  }
  writeHashFields<T extends Record<string, unknown>>(context: F.Context, opt: { key?: KEY; value: T; expiry?: number }): T.PPromise<void> {
    const key = this._getKey(opt.key);
    if (!this.canExeWrite()) {
      context.logDebug(`${this.name}.write(${key}, [${Object.keys(opt.value)}])`, "Method not allowed");
      return T.PPromise.resolve(void 0) as any;
    }
    const start = Date.now();
    return this.cache.writeHashFields(context, { ...opt, key, expiry: opt.expiry ?? this.expiry }).$then((data) => {
      if (this.log) {
        context.logDebug(`${this.name}.write(${key}, [${Object.keys(opt.value)}])`, `${Date.now() - start} ms`);
      }
      return data;
    }, (err) => {
      this.onError(context, err);
    });
  }
  removeKey(context: F.Context, opt: { key?: KEY }): T.PPromise<void> {
    const key = this._getKey(opt.key);
    if (!this.canExeRemove()) {
      context.logDebug(`${this.name}.remove(${key})`, "Method not allowed");
      return T.PPromise.resolve(void 0) as any;
    }
    const start = Date.now();
    return this.cache.removeKey(context, { ...opt, key }).$then((data) => {
      if (this.log) {
        context.logMsg(`${this.name}.remove(${key})`, `${Date.now() - start} ms`);
      }
      return data;
    }, (err) => {
      this.onError(context, err);
    });
  }
  removeHashFields(context: F.Context, opt: { key?: KEY; fields: KEY[] | AllFields }): T.PPromise<void> {
    const key = this._getKey(opt.key);
    if (!this.canExeRemove()) {
      context.logDebug(`${this.name}.remove(${key}, [${opt.fields}])`, "Method not allowed");
      return T.PPromise.resolve(void 0) as any;
    }
    const start = Date.now();
    return this.cache.removeHashFields(context, { ...opt, key }).$then((data) => {
      if (this.log) {
        context.logDebug(`${this.name}.remove(${key}, [${opt.fields}])`, `${Date.now() - start} ms`);
      }
      return data;
    }, (err) => {
      this.onError(context, err);
    });
  }
  incrementKey(
    context: F.Context,
    opt: { key?: KEY; incrBy: number; maxLimit: number; expiry?: number },
  ): T.PPromise<{ allowed: boolean; value: number }> {
    const key = this._getKey(opt.key);
    if (!this.canExeIncrement()) {
      context.logDebug(`${this.name}.incr(${key}, [+${opt.incrBy}, <${opt.maxLimit}])`, "Method not allowed");
      return T.PPromise.resolve({ allowed: true, value: 0 }) as any;
    }
    const start = Date.now();
    return this.cache.incrementKey(context, { ...opt, key, expiry: opt.expiry ?? this.expiry }).$then((data) => {
      if (this.log) {
        context.logDebug(`${this.name}.incr(${key}, [+${opt.incrBy}, <${opt.maxLimit}])`, `${Date.now() - start} ms`);
      }
      return data;
    }, (err) => {
      this.onError(context, err);
      return { allowed: true, value: 0 };
    });
  }
  incrementHashField(
    context: F.Context,
    opt: { key?: KEY; field: KEY; incrBy: number; maxLimit: number; expiry?: number },
  ): T.PPromise<{ allowed: boolean; value: number }> {
    const key = this._getKey(opt.key);
    if (!this.canExeIncrement()) {
      context.logDebug(`${this.name}.incr(${key}, [${opt.field}, +${opt.incrBy}, <${opt.maxLimit}])`, "Method not allowed");
      return T.PPromise.resolve({ allowed: true, value: 0 }) as any;
    }
    const start = Date.now();
    return this.cache.incrementHashField(context, { ...opt, key, expiry: opt.expiry ?? this.expiry }).$then((data) => {
      if (this.log) {
        context.logDebug(`${this.name}.incr(${key}, [${opt.field}, +${opt.incrBy}, <${opt.maxLimit}])`, `${Date.now() - start} ms`);
      }
      return data;
    }, (err) => {
      this.onError(context, err);
      return { allowed: true, value: 0 };
    });
  }
  /********************* Builds *********************/
  set(opt: {
    mode?: "read-write" | "readonly" | "writeonly" | "ignore";
    expiry?: number;
    log?: boolean;
  }): CacheApi<C> {
    return new CacheApi(
      this.cache,
      this.name,
      this.separator,
      this.prefix,
      opt.expiry ?? this.expiry,
      opt.mode ?? this.mode,
      opt.log ?? this.log,
      this.onError,
    );
  }
  addPrefix(...prefix: (string | number)[]): CacheApi<C> {
    return new CacheApi(
      this.cache,
      this.name,
      this.separator,
      `${this.prefix}${this.separator}${prefix.join(this.separator)}`,
      this.expiry,
      this.mode,
      this.log,
      this.onError,
    );
  }
  /********************* Utils *********************/
  canExeExists(): boolean {
    return this.mode === "read-write" || this.mode === "readonly";
  }
  canExeRead(): boolean {
    return this.mode === "read-write" || this.mode === "readonly";
  }
  canExeWrite(): boolean {
    return this.mode === "read-write" || this.mode === "writeonly";
  }
  canExeRemove(): boolean {
    return this.mode === "read-write" || this.mode === "writeonly";
  }
  canExeIncrement(): boolean {
    return this.mode === "read-write";
  }
}
