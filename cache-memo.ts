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
 * import { C } from '@panth977/cache';
 *
 * const cache = new C.CacheApi({
 *   client: new C.MemoCacheClient(),
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
  constructor(memo?: Map<KEY, Obj | Hash>) {
    super();
    this.memo = memo ?? new Map();
  }
  override existsKey(_context: F.Context, opt: { key: KEY }): Promise<boolean> {
    const exists = opt.key in this.memo;
    return Promise.resolve(exists);
  }
  override existsHashFields(
    _context: F.Context,
    opt: { key: KEY; fields: Array<KEY> | AllFields },
  ): Promise<Record<string, boolean>> {
    const hashValue = this.memo.get(opt.key);
    if (!hashValue) {
      return Promise.resolve({});
    } else if (hashValue instanceof Hash === false) {
      return Promise.reject(new Error("Invalid hash value"));
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
      return Promise.resolve(fieldsExists);
    }
  }
  override readKey<T>(
    _context: F.Context,
    opt: { key: KEY },
  ): Promise<T | undefined> {
    const value = this.memo.get(opt.key) as Obj<T>;
    if (!value) {
      return Promise.resolve<T | undefined>(undefined);
    } else if (value instanceof Obj === false) {
      return Promise.reject(new Error("Invalid value"));
    } else {
      return Promise.resolve<T | undefined>(value.val);
    }
  }
  override readHashFields<T extends Record<string, unknown>>(
    _context: F.Context,
    opt: { key: KEY; fields: KEY[] | AllFields },
  ): Promise<Partial<T>> {
    const hashValue = this.memo.get(opt.key) as Hash<T>;
    if (!hashValue) {
      return Promise.resolve({});
    } else if (hashValue instanceof Hash === false) {
      return Promise.reject(new Error("Invalid hash value"));
    } else {
      if (opt.fields === "*") {
        return Promise.resolve({ ...hashValue.val });
      } else {
        const fieldsExists: Partial<T> = {};
        for (const field of opt.fields) {
          (fieldsExists as any)[field] = hashValue.val[field];
        }
        return Promise.resolve(fieldsExists);
      }
    }
  }
  override writeKey<T>(
    _context: F.Context,
    opt: { key: KEY; value: T; expiry: number },
  ): Promise<void> {
    const value = this.memo.get(opt.key);
    if (value) clearTimeout(value.timeout);
    const timeout = setTimeout(
      this.memo.delete.bind(this.memo, opt.key),
      opt.expiry,
    );
    this.memo.set(opt.key, new Obj(opt.value, timeout));
    return Promise.resolve<void>(undefined);
  }
  override writeHashFields<T extends Record<string, unknown>>(
    _context: F.Context,
    opt: { key: KEY; value: T; expiry: number },
  ): Promise<void> {
    const value = this.memo.get(opt.key);
    if (value instanceof Hash) {
      Object.assign(value.val, opt.value);
    } else {
      if (value) clearTimeout(value.timeout);
      const timeout = setTimeout(
        this.memo.delete.bind(this.memo, opt.key),
        opt.expiry,
      );
      this.memo.set(opt.key, new Hash({ ...opt.value }, timeout));
    }
    return Promise.resolve<void>(undefined);
  }

  override removeKey(_context: F.Context, opt: { key: KEY }): Promise<void> {
    const value = this.memo.get(opt.key);
    if (value) clearTimeout(value.timeout);
    this.memo.delete(opt.key);
    return Promise.resolve<void>(undefined);
  }
  override removeHashFields(
    _context: F.Context,
    opt: { key: KEY; fields: KEY[] | AllFields },
  ): Promise<void> {
    const hashValue = this.memo.get(opt.key);
    if (!hashValue) {
      return Promise.resolve<void>(undefined);
    } else if (hashValue instanceof Hash === false) {
      return Promise.reject(new Error("Invalid hash value"));
    } else {
      if (opt.fields === "*") {
        clearTimeout(hashValue.timeout);
        this.memo.delete(opt.key);
      } else {
        for (const field of opt.fields) {
          delete hashValue.val[field];
        }
        if (Object.keys(hashValue.val).length === 0) {
          clearTimeout(hashValue.timeout);
          this.memo.delete(opt.key);
        }
      }
      return Promise.resolve<void>(undefined);
    }
  }
  override incrementKey(
    _c: F.Context,
    _i: { expiry: number; key: KEY; incrBy: number; maxLimit: number },
  ): Promise<{ allowed: boolean; value: number }> {
    return Promise.reject(new Error("Unimplemented!"));
  }
  override incrementHashField(
    _c: F.Context,
    _i: {
      expiry: number;
      key: KEY;
      field: KEY;
      incrBy: number;
      maxLimit: number;
    },
  ): Promise<{ allowed: boolean; value: number }> {
    return Promise.reject(new Error("Unimplemented!"));
  }
  override dispose(): void {
    for (const value of this.memo.values()) {
      clearTimeout(value.timeout);
    }
    this.memo.clear();
  }
}
