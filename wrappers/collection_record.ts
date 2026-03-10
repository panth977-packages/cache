import type { F } from "@panth977/functions";
import { type AllowedTypes, WFGenericCache } from "./_helper.ts";
import type z from "zod";
import type { CacheController } from "../exports.ts";
import { T } from "@panth977/tools";

type Output = z.ZodRecord<z.ZodString, any>;
type Cache<I extends z.ZodType, O extends Output> = [
  CacheController,
  z.infer<I>,
  Idx[] | "*",
  ...([z.infer<O>] | []),
];
const iController = 0;
const iInput = 1;
const iIds = 2;
const iOutput = 3;
type Idx = string;
type Value<O extends Output> = z.infer<O["valueSchema"]>;
/**
 * ```ts
 * const cache = new MemoCacheClient({...});
 * const getUserDevices = F.asyncFunc()
 *   .$input(
 *     z.object({
 *       userId: z.number(),
 *       deviceIds: z.union([z.literal("*"), z.string().array()]).optional().default("*"),
 *       _ignoreDeviceIds: z.string().array().optional().default([]),
 *     }),
 *   )
 *   .$output(
 *     z.record(
 *       z.string(),
 *       z.object({ id: z.string(), lat: z.number(), lon: z.number() }),
 *     ),
 *   )
 *   .$wrap(
 *     new WFCollectionCacheRecord({
 *       getController: (input) => [cache.addPrefix("Devices", input.userId), input.deviceIds],
 *       updateInput: (input, notFound, found) => ({...input, deviceIds: notFound, _ignoreDeviceIds: found}),
 *     }),
 *   )
 *   .$(async (context, {userId, deviceIds, _ignoreDeviceIds}) => {
 *     type Device = { id: string; lat: number; lon: number };
 *     const result = await pg.query<Device>(`
 *      SELECT *
 *      FROM devices
 *      WHERE user_id = ?
 *        ${deviceIds === '*' ? '' : `AND id IN (${new Array(deviceIds.length).fill('?')})`}
 *        ${!_ignoreDeviceIds.length ? '' : `AND id NOT IN (${new Array(_ignoreDeviceIds.length).fill('?')})`}
 *      `, [userId, ...(deviceIds === '*' ? [] : deviceIds), ..._ignoreDeviceIds]);
 *     const data = T.oneToOneMapping(result.rows, T.AccessKey("id"));
 *     return data;
 *   });
 * ```
 */
export class WFCollectionCacheRecord<
  I extends F.FuncInput,
  O extends Output,
  Type extends AllowedTypes,
> extends WFGenericCache<Cache<I, O>, I, O, Type> {
  protected readonly getController: (input: z.infer<I>) => [CacheController, Idx[] | "*"];
  protected readonly updateInput: (input: z.infer<I>, notFoundIds: Idx[] | "*", found: Idx[]) => z.infer<I>;
  constructor({ getController, updateInput, onInit }: {
    onInit?: (hook: WFCollectionCacheRecord<I, O, Type>) => void;
    getController: (input: z.infer<I>) => [CacheController, Idx[] | "*"];
    updateInput: (
      input: z.infer<I>,
      notFoundIds: Idx[] | "*",
      found: Idx[],
    ) => z.infer<I>;
  }) {
    super({ onInit } as any);
    this.getController = getController;
    this.updateInput = updateInput;
  }
  private outputFactory(): Record<Idx, Value<O>> {
    return {};
  }
  protected override _getCacheController(_context: F.Context, input: z.infer<I>): Cache<I, O> {
    const [controller, ids] = this.getController(input);
    return [controller, input, ids];
  }
  protected override _getData(context: F.Context, cache: Cache<I, O>): T.PPromise<void> {
    if (cache[iIds] === "*") {
      return cache[iController]
        .readHashFields<Record<Idx, Value<O>>>(context, { fields: "*" })
        .map(({ $, ...result }) => {
          let value = this.outputFactory();
          for (const key in result) {
            value[key] = result[key];
          }
          value = this.func.output.parse(value);
          cache[iOutput] = value;
          if ($) {
            cache[iIds] = [];
          } else {
            cache[iInput] = this.updateInput(cache[iInput], "*", Object.keys(value));
            cache[iIds] = "*";
          }
        });
    } else {
      if (cache[iIds].includes("$")) {
        return T.PPromise.reject(new Error("Cannot use $ in ids, it is a reserved keyword"));
      }
      return cache[iController]
        .readHashFields<z.infer<O>>(context, { fields: cache[iIds] })
        .map((result) => {
          let value = this.outputFactory();
          const notFound: Idx[] = [];
          for (const key of cache[iIds]) {
            if (result[key] === undefined) {
              notFound.push(key);
            } else {
              value[key] = this.func.output.valueSchema.parse(result[key]);
            }
          }
          value = this.func.output.parse(value);
          cache[iOutput] = value;
          if (notFound.length) {
            cache[iInput] = this.updateInput(
              cache[iInput],
              notFound,
              Object.keys(value),
            );
            cache[iIds] = notFound;
          } else {
            cache[iIds] = [];
          }
        });
    }
  }
  protected override _shouldInvoke(cache: Cache<I, O>): boolean {
    if (cache.length) return true;
    return false;
  }
  protected override _updatedInput(_context: F.Context, cache: Cache<I, O>): z.infer<I> {
    return cache[iInput];
  }
  protected override _setData(context: F.Context, cache: Cache<I, O>, output: z.infer<O>): T.PPromise<void> {
    cache[iOutput] ??= this.outputFactory();
    for (const [key, value] of Object.entries(output)) {
      cache[iOutput].set(key, value);
    }
    return cache[iController].writeHashFields(context, {
      value: output.toRecord(),
    });
  }
  protected override _convertCache(cache: Cache<I, O>): z.infer<O> {
    if (cache[iOutput] === undefined) {
      throw new Error("Need to gothrough the [_getData] api");
    }
    return cache[iOutput];
  }
  protected override _delCache(context: F.Context, cache: Cache<I, O>): T.PPromise<void> {
    if (cache[iIds] === "*") {
      return cache[iController].removeHashFields(context, { fields: "*" });
    } else {
      return cache[iController].removeHashFields(context, {
        fields: [...cache[iIds], "$"],
      });
    }
  }
}
