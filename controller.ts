import type { FUNCTIONS } from "@panth977/functions";
export type KEY = string | number;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
type ExtendedFunc<P, R> = (
  context: FUNCTIONS.Context,
  controller: CacheController | null,
  params: P
) => R;
type ExtendedFuncNames<T extends AbstractCacheClient> = {
  [K in keyof T]: T[K] extends ExtendedFunc<Any, Any> ? K : never;
}[keyof T];
type Actions<T extends AbstractCacheClient> = { "*": boolean } & Partial<
  Record<
    | (string & Record<never, never>)
    | ExtendedFuncNames<T>
    | "exists"
    | "read"
    | "write"
    | "remove",
    boolean
  >
>;
const AllFieldsSymbol: unique symbol = Symbol();
type AllFieldsSymbol = typeof AllFieldsSymbol;
/**
 * How a Cache Client should be, the typical APIs (methods) needed to leverage wrapper!
 */ export abstract class AbstractCacheClient {
  readonly name: string;
  static get AllFields(): AllFieldsSymbol {
    return AllFieldsSymbol;
  }
  constructor(name: string) {
    this.name = name;
  }

  abstract existsKey(
    context: FUNCTIONS.Context,
    key: KEY,
    log?: boolean
  ): Promise<boolean>;
  abstract existsHashFields(
    context: FUNCTIONS.Context,
    key: KEY,
    fields: KEY[] | AllFieldsSymbol,
    log?: boolean
  ): Promise<Record<string, boolean>>;
  abstract readKey<T>(
    context: FUNCTIONS.Context,
    key: KEY,
    log?: boolean
  ): Promise<T | undefined>;
  abstract readHashFields<T extends Record<string, unknown>>(
    context: FUNCTIONS.Context,
    key: KEY,
    fields: KEY[] | AllFieldsSymbol,
    log?: boolean
  ): Promise<Partial<T>>;
  abstract writeKey<T>(
    context: FUNCTIONS.Context,
    key: KEY,
    value: T | Promise<T>,
    expire: number,
    log?: boolean
  ): Promise<void>;
  abstract writeHashFields<T extends Record<string, unknown>>(
    context: FUNCTIONS.Context,
    key: KEY,
    value: T | Promise<T>,
    expire: number,
    log?: boolean
  ): Promise<void>;
  abstract removeKey(
    context: FUNCTIONS.Context,
    key: KEY,
    log?: boolean
  ): Promise<void>;
  abstract removeHashFields(
    context: FUNCTIONS.Context,
    key: KEY,
    fields: KEY[] | AllFieldsSymbol,
    log?: boolean
  ): Promise<void>;
}

/**
 * wrappers for {@link AbstractCacheClient} to streamline the
 */ export class CacheController<
  T extends AbstractCacheClient = AbstractCacheClient
> {
  readonly separator: string;
  readonly defaultExpiry: number;
  readonly client: T;
  readonly prefix: string;
  readonly log: boolean;
  readonly allowed: Actions<T>;
  constructor({
    allowed,
    client,
    defaultExpiry,
    log,
    prefix,
    separator,
  }: {
    client: T;
    separator: string;
    defaultExpiry: number;
    prefix: string;
    allowed: Actions<T>;
    log: boolean;
  }) {
    this.client = client;
    this.separator = separator;
    this.defaultExpiry = defaultExpiry;
    this.prefix = prefix;
    this.allowed = allowed;
    this.log = log;
  }
  getKey(key: string | number): string {
    return `${this.prefix}${this.separator}${key}`;
  }
  can(key: keyof Actions<T>): boolean {
    return (this.allowed as never)[key] ?? this.allowed["*"];
  }

  /*******************************************/

  /* Builds */
  setDefaultExp(exp: number): CacheController<T> {
    return new CacheController({
      client: this.client,
      separator: this.separator,
      defaultExpiry: exp,
      prefix: this.prefix,
      allowed: this.allowed,
      log: this.log,
    });
  }
  addPrefix(prefix: string | number): CacheController<T> {
    return new CacheController({
      client: this.client,
      separator: this.separator,
      defaultExpiry: this.defaultExpiry,
      prefix: this.getKey(prefix),
      allowed: this.allowed,
      log: this.log,
    });
  }
  setLogging(opt: boolean): CacheController<T> {
    return new CacheController({
      client: this.client,
      separator: this.separator,
      defaultExpiry: this.defaultExpiry,
      prefix: this.prefix,
      allowed: this.allowed,
      log: opt,
    });
  }
  setAllowance(opt: Omit<Actions<T>, "*">): CacheController<T> {
    return new CacheController({
      client: this.client,
      separator: this.separator,
      defaultExpiry: this.defaultExpiry,
      prefix: this.prefix,
      allowed: Object.assign({}, this.allowed, opt),
      log: this.log,
    });
  }
  /* Controllers */
  async existsKey(
    context: FUNCTIONS.Context,
    params: { key?: KEY }
  ): Promise<boolean> {
    if (!this.can("exists")) return false;
    const result = await this.client
      .existsKey(context, this.getKey(`${params.key ?? ""}`), this.log)
      .catch(() => false);
    return result;
  }
  async existsHashFields(
    context: FUNCTIONS.Context,
    params: { key?: KEY; fields?: KEY[] | "*" }
  ): Promise<Record<KEY, boolean>> {
    if (!this.can("exists")) return {};
    const result = await this.client
      .existsHashFields(
        context,
        this.getKey(`${params.key ?? ""}`),
        (params.fields === "*" ? undefined : params.fields) ??
          AbstractCacheClient.AllFields,
        this.log
      )
      .catch(() => ({}));
    return result;
  }
  async readKey<T>(
    context: FUNCTIONS.Context,
    params: { key?: KEY }
  ): Promise<T | undefined> {
    if (!this.can("read")) return undefined;
    const result = await this.client
      .readKey<T>(context, this.getKey(`${params.key ?? ""}`), this.log)
      .catch(() => undefined);
    return result;
  }
  async readHashFields<T extends Record<KEY, unknown>>(
    context: FUNCTIONS.Context,
    params: { key?: KEY; fields?: KEY[] | "*" }
  ): Promise<Partial<T>> {
    if (!this.can("read")) return {};
    const result = await this.client
      .readHashFields<T>(
        context,
        this.getKey(`${params.key ?? ""}`),
        (params.fields === "*" ? undefined : params.fields) ??
          AbstractCacheClient.AllFields,
        this.log
      )
      .catch(() => ({}));
    return result;
  }
  async writeKey<T>(
    context: FUNCTIONS.Context,
    params: { key?: KEY; value: T | Promise<T>; expire?: number }
  ): Promise<void> {
    if (!this.can("write")) return;
    await this.client
      .writeKey(
        context,
        this.getKey(`${params.key ?? ""}`),
        params.value,
        params.expire ?? this.defaultExpiry,
        this.log
      )
      .catch(() => {});
  }
  async writeHashFields<T extends Record<KEY, unknown>>(
    context: FUNCTIONS.Context,
    params: { key?: KEY; value: T | Promise<T>; expire?: number }
  ): Promise<void> {
    if (!this.can("write")) return;
    await this.client
      .writeHashFields(
        context,
        this.getKey(`${params.key ?? ""}`),
        params.value,
        params.expire ?? this.defaultExpiry,
        this.log
      )
      .catch(() => {});
  }
  async removeKey(
    context: FUNCTIONS.Context,
    params: { key?: KEY }
  ): Promise<void> {
    if (!this.can("remove")) return;
    await this.client
      .removeKey(context, this.getKey(`${params.key ?? ""}`), this.log)
      .catch(() => undefined);
  }
  async removeHashFields(
    context: FUNCTIONS.Context,
    params: { key?: KEY; fields?: KEY[] | "*" }
  ): Promise<void> {
    if (!this.can("remove")) return;
    await this.client
      .removeHashFields(
        context,
        this.getKey(`${params.key ?? ""}`),
        (params.fields === "*" ? undefined : params.fields) ??
          AbstractCacheClient.AllFields,
        this.log
      )
      .catch(() => ({}));
  }
  /* Extensions */
  run<K extends ExtendedFuncNames<T>>(
    context: FUNCTIONS.Context,
    method: K,
    params: T[K] extends ExtendedFunc<infer P, Any> ? P : never
  ): T[K] extends ExtendedFunc<Any, infer R> ? R : never {
    return (this.client[method] as ExtendedFunc<unknown, unknown>)(
      context,
      this,
      params
    ) as never;
  }
}
