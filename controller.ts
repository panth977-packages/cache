import type { F } from "@panth977/functions";
import type { T } from "@panth977/tools";
export type KEY = string | number;
export type AllFields = "*";
/**
 * wrappers for {@link AbstractCacheClient} to streamline the
 */ export abstract class CacheController {
  protected name: string;
  protected separator: string;
  protected prefix: string = "";
  protected expiry: number;
  protected mode: "read-write" | "readonly" | "writeonly";
  protected log: boolean;
  constructor({
    name,
    expiry,
    log,
    separator,
    mode,
  }: {
    name: string;
    separator: string;
    expiry: number;
    prefix: string;
    log: boolean;
    mode: "read-write" | "readonly" | "writeonly";
  }) {
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
  abstract existsKeyCb(
    context: F.Context,
    opt: { key?: KEY },
  ): T.PPromise<boolean>;
  abstract existsHashFieldsCb(
    context: F.Context,
    opt: { key?: KEY; fields: Array<KEY> | AllFields },
  ): T.PPromise<Record<string, boolean>>;
  abstract readKeyCb<T>(
    context: F.Context,
    opt: { key?: KEY },
  ): T.PPromise<T | undefined>;
  abstract readHashFieldsCb<T extends Record<string, unknown>>(
    context: F.Context,
    opt: { key?: KEY; fields: KEY[] | AllFields },
  ): T.PPromise<Partial<T>>;
  abstract writeKeyCb<T>(
    context: F.Context,
    opt: { key?: KEY; value: T },
  ): T.PPromise<void>;
  abstract writeHashFieldsCb<T extends Record<string, unknown>>(
    context: F.Context,
    opt: { key?: KEY; value: T },
  ): T.PPromise<void>;
  abstract removeKeyCb(
    context: F.Context,
    opt: { key?: KEY },
  ): T.PPromise<void>;
  abstract removeHashFieldsCb(
    context: F.Context,
    opt: { key?: KEY; fields: KEY[] | AllFields },
  ): T.PPromise<void>;
  abstract incrementKeyCb(
    context: F.Context,
    opt: { key?: KEY; incrBy: number; maxLimit: number },
  ): T.PPromise<{ allowed: boolean; value: number }>;
  abstract incrementHashFieldCb(
    context: F.Context,
    opt: { key?: KEY; field: KEY; incrBy: number; maxLimit: number },
  ): T.PPromise<{ allowed: boolean; value: number }>;
  abstract dispose(): void;
  /********************* Builds *********************/
  protected abstract clone(): this;
  set(opt: {
    mode?: "read-write" | "readonly" | "writeonly";
    expiry?: number;
    log?: boolean;
  }): this {
    const clone = this.clone();
    if (opt.mode !== undefined) clone.mode = opt.mode;
    if (opt.expiry !== undefined) clone.expiry = opt.expiry;
    if (opt.log !== undefined) clone.log = opt.log;
    return clone;
  }
  addPrefix(...prefix: (string | number)[]): this {
    const clone = this.clone();
    clone.prefix = prefix.reduce<string>(
      (x, p) => `${x}${this.separator}${p}`,
      this.prefix,
    );
    return clone;
  }
  /********************* Utils *********************/
  protected canExeExists(): boolean {
    return this.mode === "read-write" || this.mode === "readonly";
  }
  protected canExeRead(): boolean {
    return this.mode === "read-write" || this.mode === "readonly";
  }
  protected canExeWrite(): boolean {
    return this.mode === "read-write" || this.mode === "writeonly";
  }
  protected canExeRemove(): boolean {
    return this.mode === "read-write" || this.mode === "writeonly";
  }
  protected canExeIncrement(): boolean {
    return this.mode === "read-write";
  }
}
