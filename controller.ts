import type { FUNCTIONS } from "@panth977/functions";
export type KEY = string | number;
export type AllFields = "*";
type Any = any;
type ExtendedFunc<P, R> = (arg: {
  context?: FUNCTIONS.Context;
  controller: CacheController | null;
  params: P;
}) => R;
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
    | "remove"
    | "increment",
    boolean
  >
>;
/**
 * How a Cache Client should be, the typical APIs (methods) needed to leverage wrapper!
 */ export abstract class AbstractCacheClient {
  readonly name: string;
  constructor(name: string) {
    this.name = name;
  }

  abstract existsKey(arg: {
    context?: FUNCTIONS.Context;
    key: KEY;
    log?: boolean;
  }): Promise<boolean>;
  abstract existsHashFields(arg: {
    context?: FUNCTIONS.Context;
    key: KEY;
    fields: KEY[] | AllFields;
    log?: boolean;
  }): Promise<Record<string, boolean>>;
  abstract readKey<T>(arg: {
    context?: FUNCTIONS.Context;
    key: KEY;
    log?: boolean;
  }): Promise<T | undefined>;
  abstract readHashFields<T extends Record<string, unknown>>(arg: {
    context?: FUNCTIONS.Context;
    key: KEY;
    fields: KEY[] | AllFields;
    log?: boolean;
  }): Promise<Partial<T>>;
  abstract writeKey<T>(arg: {
    context?: FUNCTIONS.Context;
    key: KEY;
    value: T | Promise<T>;
    expiry: number;
    log?: boolean;
  }): Promise<void>;
  abstract writeHashFields<T extends Record<string, unknown>>(arg: {
    context?: FUNCTIONS.Context;
    key: KEY;
    value: Promise<T> | { [k in keyof T]: Promise<T[k]> | T[k] };
    expiry: number;
    log?: boolean;
  }): Promise<void>;
  abstract removeKey(arg: {
    context?: FUNCTIONS.Context;
    key: KEY;
    log?: boolean;
  }): Promise<void>;
  abstract removeHashFields(arg: {
    context?: FUNCTIONS.Context;
    key: KEY;
    fields: KEY[] | AllFields;
    log?: boolean;
  }): Promise<void>;
  abstract incrementKey(arg: {
    context?: FUNCTIONS.Context;
    key: KEY;
    incrBy: number;
    maxLimit?: number;
    expiry: number;
    log?: boolean;
  }): Promise<{ allowed: boolean; value: number }>;
  abstract incrementHashField(arg: {
    context?: FUNCTIONS.Context;
    key: KEY;
    field?: KEY;
    incrBy: number;
    maxLimit?: number;
    expiry: number;
    log?: boolean;
  }): Promise<{ allowed: boolean; value: number }>;
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
    if (key === "") return this.prefix;
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
  addPrefix(...prefix: (string | number)[]): CacheController<T> {
    return new CacheController({
      client: this.client,
      separator: this.separator,
      defaultExpiry: this.defaultExpiry,
      prefix: prefix.reduce<string>(
        (x, p) => `${x}${this.separator}${p}`,
        this.prefix
      ),
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
  setAllowance(opt: Omit<Actions<T>, "*"> | boolean): CacheController<T> {
    return new CacheController({
      client: this.client,
      separator: this.separator,
      defaultExpiry: this.defaultExpiry,
      prefix: this.prefix,
      allowed:
        typeof opt === "boolean"
          ? ({ "*": opt } as never)
          : Object.assign({}, this.allowed, opt),
      log: this.log,
    });
  }
  /* Controllers */
  async existsKey({
    context,
    ...params
  }: {
    context?: FUNCTIONS.Context;
    key?: KEY;
  }): Promise<boolean> {
    if (!this.can("exists")) return false;
    const result = await this.client
      .existsKey({
        context,
        key: this.getKey(`${params.key ?? ""}`),
        log: this.log,
      })
      .catch(() => false);
    return result;
  }
  async existsHashFields({
    context,
    ...params
  }: {
    context?: FUNCTIONS.Context;
    key?: KEY;
    fields?: KEY[] | AllFields;
  }): Promise<Record<KEY, boolean>> {
    if (!this.can("exists")) return {};
    const result = await this.client
      .existsHashFields({
        context,
        key: this.getKey(`${params.key ?? ""}`),
        fields: params.fields ?? "*",
        log: this.log,
      })
      .catch(() => ({}));
    return result;
  }
  async readKey<T>({
    context,
    ...params
  }: {
    context?: FUNCTIONS.Context;
    key?: KEY;
  }): Promise<T | undefined> {
    if (!this.can("read")) return undefined;
    const result = await this.client
      .readKey<T>({
        context,
        key: this.getKey(`${params.key ?? ""}`),
        log: this.log,
      })
      .catch(() => undefined);
    return result;
  }
  async readHashFields<T extends Record<KEY, unknown>>({
    context,
    ...params
  }: {
    context?: FUNCTIONS.Context;
    key?: KEY;
    fields?: KEY[] | AllFields;
  }): Promise<Partial<T>> {
    if (!this.can("read")) return {};
    const result = await this.client
      .readHashFields<T>({
        context,
        key: this.getKey(`${params.key ?? ""}`),
        fields: params.fields ?? "*",
        log: this.log,
      })
      .catch(() => ({}));
    return result;
  }
  async writeKey<T>({
    context,
    ...params
  }: {
    context?: FUNCTIONS.Context;
    key?: KEY;
    value: T | Promise<T>;
    expiry?: number;
  }): Promise<void> {
    if (!this.can("write")) return;
    await this.client
      .writeKey({
        context,
        key: this.getKey(`${params.key ?? ""}`),
        value: params.value,
        expiry: params.expiry ?? this.defaultExpiry,
        log: this.log,
      })
      .catch(() => {});
  }
  async writeHashFields<T extends Record<KEY, unknown>>({
    context,
    ...params
  }: {
    context?: FUNCTIONS.Context;
    key?: KEY;
    value: T | Promise<T>;
    expiry?: number;
  }): Promise<void> {
    if (!this.can("write")) return;
    await this.client
      .writeHashFields({
        context,
        key: this.getKey(`${params.key ?? ""}`),
        value: params.value,
        expiry: params.expiry ?? this.defaultExpiry,
        log: this.log,
      })
      .catch(() => {});
  }
  async removeKey({
    context,
    ...params
  }: {
    context?: FUNCTIONS.Context;
    key?: KEY;
  }): Promise<void> {
    if (!this.can("remove")) return;
    await this.client
      .removeKey({
        context,
        key: this.getKey(`${params.key ?? ""}`),
        log: this.log,
      })
      .catch(() => {});
  }
  async removeHashFields({
    context,
    ...params
  }: {
    context?: FUNCTIONS.Context;
    key?: KEY;
    fields?: KEY[] | AllFields;
  }): Promise<void> {
    if (!this.can("remove")) return;
    await this.client
      .removeHashFields({
        context,
        key: this.getKey(`${params.key ?? ""}`),
        fields: params.fields ?? "*",
        log: this.log,
      })
      .catch(() => {});
  }
  async incrementKey({
    context,
    ...params
  }: {
    context?: FUNCTIONS.Context;
    key?: KEY;
    incrBy: number;
    maxLimit?: number;
    expiry: number;
  }): Promise<{ allowed: boolean; value: number }> {
    if (!this.can("increment")) return { allowed: false, value: 0 };
    return await this.client
      .incrementKey({
        context,
        key: this.getKey(`${params.key ?? ""}`),
        expiry: params.expiry ?? this.defaultExpiry,
        incrBy: params.incrBy,
        maxLimit: params.maxLimit,
        log: this.log,
      })
      .catch(() => ({ allowed: false, value: 0 }));
  }
  async incrementHashField({
    context,
    ...params
  }: {
    context?: FUNCTIONS.Context;
    key?: KEY;
    field: KEY;
    incrBy: number;
    maxLimit?: number;
    expiry?: number;
  }): Promise<{ allowed: boolean; value: number }> {
    if (!this.can("increment")) return { allowed: false, value: 0 };
    return await this.client
      .incrementHashField({
        context,
        key: this.getKey(`${params.key ?? ""}`),
        field: params.field,
        expiry: params.expiry ?? this.defaultExpiry,
        incrBy: params.incrBy,
        maxLimit: params.maxLimit,
        log: this.log,
      })
      .catch(() => ({ allowed: false, value: 0 }));
  }
  /* Extensions */
  run<K extends ExtendedFuncNames<T>>({
    context,
    method,
    params,
  }: {
    context?: FUNCTIONS.Context;
    method: K;
    params: T[K] extends ExtendedFunc<infer P, Any> ? P : never;
  }): T[K] extends ExtendedFunc<Any, infer R> ? R : never {
    return (this.client[method] as ExtendedFunc<unknown, unknown>)({
      context,
      controller: this,
      params,
    }) as never;
  }
}
