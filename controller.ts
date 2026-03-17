import type { F } from "@panth977/functions";

export type KEY = string | number;
export type AllFields = "*";

/**
 * wrappers for {@link AbstractCacheClient} to streamline the
 */
export abstract class CacheController {
  constructor() {}
  abstract existsKey(context: F.Context, opt: { key: KEY }): Promise<boolean>;
  abstract existsHashFields(
    context: F.Context,
    opt: { key: KEY; fields: Array<KEY> | AllFields },
  ): Promise<Record<string, boolean>>;
  abstract readKey<T>(
    context: F.Context,
    opt: { key: KEY },
  ): Promise<T | undefined>;
  abstract readHashFields<T extends Record<string, unknown>>(
    context: F.Context,
    opt: { key: KEY; fields: KEY[] | AllFields },
  ): Promise<Partial<T>>;
  abstract writeKey<T>(
    context: F.Context,
    opt: { expiry: number; key: KEY; value: T },
  ): Promise<void>;
  abstract writeHashFields<T extends Record<string, unknown>>(
    context: F.Context,
    opt: { expiry: number; key: KEY; value: T },
  ): Promise<void>;
  abstract removeKey(context: F.Context, opt: { key: KEY }): Promise<void>;
  abstract removeHashFields(
    context: F.Context,
    opt: { key: KEY; fields: KEY[] | AllFields },
  ): Promise<void>;
  abstract incrementKey(
    context: F.Context,
    opt: { expiry: number; key: KEY; incrBy: number; maxLimit: number },
  ): Promise<{ allowed: boolean; value: number }>;
  abstract incrementHashField(
    context: F.Context,
    opt: {
      expiry: number;
      key: KEY;
      field: KEY;
      incrBy: number;
      maxLimit: number;
    },
  ): Promise<{ allowed: boolean; value: number }>;
  abstract dispose(): void;
}
