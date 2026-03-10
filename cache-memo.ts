import { T } from "@panth977/tools";
import { type AllFields, CacheController, type KEY } from "./controller.ts";
import type { F } from "@panth977/functions";

class Obj<T = any> {
  val: T;
  timeout: ReturnType<typeof setTimeout>;
  constructor(val: T, timeout: ReturnType<typeof setTimeout>) {
    this.val = val;
    this.timeout = timeout;
  }
}
class Hash<T extends Record<string, any> = Record<string, any>> {
  val: Partial<T>;
  timeout: ReturnType<typeof setTimeout>;
  constructor(val: Partial<T>, timeout: ReturnType<typeof setTimeout>) {
    this.val = val;
    this.timeout = timeout;
  }
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
export class MemoCacheClient extends CacheController {
  readonly memo: Map<KEY, Obj | Hash>;
  constructor(
    opt: {
      name: string;
      separator: string;
      expiry: number;
      prefix: string;
      log: boolean;
      mode: "read-write" | "readonly" | "writeonly" | "ignore";
    },
    memo?: Map<KEY, Obj | Hash>,
  ) {
    super(opt);
    this.memo = memo ?? new Map();
  }
  override existsKey(
    _context: F.Context,
    opt: { key?: KEY },
  ): T.PPromise<boolean> {
    if (this.canExeExists()) {
      // return T.PPromise.reject(new Error("Method not allowed"));
      return T.PPromise.resolve(false);
    }
    const key = this._getKey(opt.key);
    const exists = key in this.memo;
    return T.PPromise.resolve(exists);
  }
  override existsHashFields(
    _context: F.Context,
    opt: { key?: KEY; fields: Array<KEY> | AllFields },
  ): T.PPromise<Record<string, boolean>> {
    if (this.canExeExists()) {
      // return T.PPromise.reject(new Error("Method not allowed"));
      return T.PPromise.resolve({});
    }
    const key = this._getKey(opt.key);
    const hashValue = this.memo.get(key);
    if (!hashValue) {
      return T.PPromise.resolve({});
    } else if (hashValue instanceof Hash === false) {
      return T.PPromise.reject(new Error("Invalid hash value"));
    } else {
      const fieldsExists: Record<string, boolean> = {};
      if (opt.fields === "*") {
        for (const field in hashValue.val) {
          fieldsExists[field] = true;
        }
      } else {
        for (const field of opt.fields) {
          fieldsExists[field] = field in hashValue.val;
        }
      }
      return T.PPromise.resolve(fieldsExists);
    }
  }
  override readKey<T>(
    _context: F.Context,
    opt: { key?: KEY },
  ): T.PPromise<T | undefined> {
    if (this.canExeRead()) {
      // return T.PPromise.reject(new Error("Method not allowed"));
      return T.PPromise.resolve<T | undefined>(undefined);
    }
    const key = this._getKey(opt.key);
    const value = this.memo.get(key) as Obj<T>;
    if (!value) {
      return T.PPromise.resolve<T | undefined>(undefined);
    } else if (value instanceof Obj === false) {
      return T.PPromise.reject(new Error("Invalid value"));
    } else {
      return T.PPromise.resolve<T | undefined>(value.val);
    }
  }
  override readHashFields<T extends Record<string, unknown>>(
    _context: F.Context,
    opt: { key?: KEY; fields: KEY[] | AllFields },
  ): T.PPromise<Partial<T>> {
    if (this.canExeRead()) {
      // return T.PPromise.reject(new Error("Method not allowed"));
      return T.PPromise.resolve({});
    }
    const key = this._getKey(opt.key);
    const hashValue = this.memo.get(key) as Hash<T>;
    if (!hashValue) {
      return T.PPromise.resolve({});
    } else if (hashValue instanceof Hash === false) {
      return T.PPromise.reject(new Error("Invalid hash value"));
    } else {
      if (opt.fields === "*") {
        return T.PPromise.resolve({ ...hashValue.val });
      } else {
        const fieldsExists: Partial<T> = {};
        for (const field of opt.fields) {
          (fieldsExists as any)[field] = hashValue.val[field];
        }
        return T.PPromise.resolve(fieldsExists);
      }
    }
  }
  override writeKey<T>(
    _context: F.Context,
    opt: { key?: KEY; value: T },
  ): T.PPromise<void> {
    if (this.canExeWrite()) {
      // return T.PPromise.reject(new Error("Method not allowed"));
      return T.PPromise.resolve<void>(void 0);
    }
    const key = this._getKey(opt.key);
    const value = this.memo.get(key);
    if (value) clearTimeout(value.timeout);
    const timeout = setTimeout(
      this.memo.delete.bind(this.memo, key),
      this.expiry,
    );
    this.memo.set(key, new Obj(opt.value, timeout));
    return T.PPromise.resolve<void>(undefined);
  }
  override writeHashFields<T extends Record<string, unknown>>(
    _context: F.Context,
    opt: { key?: KEY; value: T },
  ): T.PPromise<void> {
    if (this.canExeWrite()) {
      // return T.PPromise.reject(new Error("Method not allowed"));
      return T.PPromise.resolve<void>(void 0);
    }
    const key = this._getKey(opt.key);
    const value = this.memo.get(key);
    if (value instanceof Hash) {
      Object.assign(value.val, opt.value);
    } else {
      if (value) clearTimeout(value.timeout);
      const timeout = setTimeout(
        this.memo.delete.bind(this.memo, key),
        this.expiry,
      );
      this.memo.set(key, new Hash({ ...opt.value }, timeout));
    }
    return T.PPromise.resolve<void>(undefined);
  }

  override removeKey(_context: F.Context, opt: { key?: KEY }): T.PPromise<void> {
    if (this.canExeRemove()) {
      // return T.PPromise.reject(new Error("Method not allowed"));
      return T.PPromise.resolve<void>(void 0);
    }
    const key = this._getKey(opt.key);
    const value = this.memo.get(key);
    if (value) clearTimeout(value.timeout);
    this.memo.delete(key);
    return T.PPromise.resolve<void>(undefined);
  }
  override removeHashFields(
    _context: F.Context,
    opt: { key?: KEY; fields: KEY[] | AllFields },
  ): T.PPromise<void> {
    if (this.canExeExists()) {
      // return T.PPromise.reject(new Error("Method not allowed"));
      return T.PPromise.resolve<void>(void 0);
    }
    const key = this._getKey(opt.key);
    const hashValue = this.memo.get(key);
    if (!hashValue) {
      return T.PPromise.resolve<void>(undefined);
    } else if (hashValue instanceof Hash === false) {
      return T.PPromise.reject(new Error("Invalid hash value"));
    } else {
      if (opt.fields === "*") {
        clearTimeout(hashValue.timeout);
        this.memo.delete(key);
      } else {
        for (const field of opt.fields) {
          delete hashValue.val[field];
        }
        if (Object.keys(hashValue.val).length === 0) {
          clearTimeout(hashValue.timeout);
          this.memo.delete(key);
        }
      }
      return T.PPromise.resolve<void>(undefined);
    }
  }
  override incrementKey(
    _c: F.Context,
    _i: { key?: KEY; incrBy: number; maxLimit: number },
  ): T.PPromise<{ allowed: boolean; value: number }> {
    return T.PPromise.reject(new Error("Unimplemented!"));
  }
  override incrementHashField(
    _c: F.Context,
    _i: { key?: KEY; field: KEY; incrBy: number; maxLimit: number },
  ): T.PPromise<{ allowed: boolean; value: number }> {
    return T.PPromise.reject(new Error("Unimplemented!"));
  }
  override dispose(): void {
    for (const value of this.memo.values()) {
      clearTimeout(value.timeout);
    }
    this.memo.clear();
  }
  override clone(): this {
    return new MemoCacheClient(
      {
        expiry: this.expiry,
        log: this.log,
        mode: this.mode,
        name: this.name,
        prefix: this.prefix,
        separator: this.separator,
      },
      this.memo,
    ) as this;
  }
}
