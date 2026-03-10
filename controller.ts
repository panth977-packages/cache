import type { F } from "@panth977/functions";
import type { T } from "@panth977/tools";
export type KEY = string | number;
export type AllFields = "*";

/**
 * wrappers for {@link AbstractCacheClient} to streamline the
 */
export abstract class CacheController {
  constructor() {}
  /********************* Controllers *********************/
  abstract existsKey(
    context: F.Context,
    opt: { key: KEY },
  ): T.PPromise<boolean>;
  abstract existsHashFields(
    context: F.Context,
    opt: { key: KEY; fields: Array<KEY> | AllFields },
  ): T.PPromise<Record<string, boolean>>;
  abstract readKey<T>(
    context: F.Context,
    opt: { key: KEY },
  ): T.PPromise<T | undefined>;
  abstract readHashFields<T extends Record<string, unknown>>(
    context: F.Context,
    opt: { key: KEY; fields: KEY[] | AllFields },
  ): T.PPromise<Partial<T>>;
  abstract writeKey<T>(
    context: F.Context,
    opt: { expiry: number; key: KEY; value: T },
  ): T.PPromise<void>;
  abstract writeHashFields<T extends Record<string, unknown>>(
    context: F.Context,
    opt: { expiry: number; key: KEY; value: T },
  ): T.PPromise<void>;
  abstract removeKey(context: F.Context, opt: { key: KEY }): T.PPromise<void>;
  abstract removeHashFields(
    context: F.Context,
    opt: { key: KEY; fields: KEY[] | AllFields },
  ): T.PPromise<void>;
  abstract incrementKey(
    context: F.Context,
    opt: { expiry: number; key: KEY; incrBy: number; maxLimit: number },
  ): T.PPromise<{ allowed: boolean; value: number }>;
  abstract incrementHashField(
    context: F.Context,
    opt: { expiry: number; key: KEY; field: KEY; incrBy: number; maxLimit: number },
  ): T.PPromise<{ allowed: boolean; value: number }>;
  abstract dispose(): void;
}
