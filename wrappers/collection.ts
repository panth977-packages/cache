import type { F } from "@panth977/functions";
import { WFGenericCache } from "./_helper.ts";
import type z from "zod";
import type { CacheApi } from "../exports.ts";
import { T } from "@panth977/tools";

type Output = T.zPreIndexedStructure<z.ZodType, z.ZodType>;
type Cache<I extends z.ZodType, O extends Output> = [
  CacheApi,
  z.infer<I>,
  Idx<O>[] | "*",
  ...([z.infer<O>] | []),
];
const iController = 0;
const iInput = 1;
const iIds = 2;
const iOutput = 3;
type Idx<O extends Output> = ReturnType<z.infer<O>["getIndexs"]>[number];
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
 *     T.zPreIndexedStructure(
 *       z.string(),
 *       z.object({ id: z.string(), lat: z.number(), lon: z.number() }),
 *     ),
 *   )
 *   .$wrap(
 *     new WFCollectionCache({
 *       getController: (input) => [cache.addPrefix("Devices", input.userId), input.deviceIds],
 *       updateInput: (input, notFound, found) => ({...input, deviceIds: notFound, _ignoreDeviceIds: found}),
 *     }),
 *   )
 *   .$(async (context, {userId, deviceIds, _ignoreDeviceIds}) => {
 *     type Device = { id: string; lat: number; lon: number };
 *     const result = await pg.query(`
 *      SELECT *
 *      FROM devices
 *      WHERE user_id = ?
 *        ${deviceIds === '*' ? '' : `AND id IN (${new Array(deviceIds.length).fill('?')})`}
 *        ${!_ignoreDeviceIds.length ? '' : `AND id NOT IN (${new Array(_ignoreDeviceIds.length).fill('?')})`}
 *      `, [userId, ...(deviceIds === '*' ? [] : deviceIds), ..._ignoreDeviceIds]);
 *     const data = new T.IndexKeyOneToOne(result.rows as Device[], T.AccessKey("id"));
 *     return data.toPreIndexed();
 *   });
 * ```
 */
export class WFCollectionCache<
  I extends F.FuncInput,
  O extends Output,
> extends WFGenericCache<Cache<I, O>, I, O> {
  protected readonly getController: (
    input: z.infer<I>,
  ) => [CacheApi, Idx<O>[] | "*"];
  protected readonly updateInput: (
    input: z.infer<I>,
    notFoundIds: Idx<O>[] | "*",
    found: Idx<O>[],
  ) => z.infer<I>;
  constructor({
    getController,
    updateInput,
    onInit,
  }: {
    onInit?: (hook: WFCollectionCache<I, O>) => void;
    getController: (input: z.infer<I>) => [CacheApi, Idx<O>[] | "*"];
    updateInput: (
      input: z.infer<I>,
      notFoundIds: Idx<O>[] | "*",
      found: Idx<O>[],
    ) => z.infer<I>;
  }) {
    super({ onInit } as any);
    this.getController = getController;
    this.updateInput = updateInput;
  }
  private outputFactory(): z.infer<O> {
    return new T.PreIndexedStructure<any, any>(0, [], []) as z.infer<O>;
  }
  protected override _getCacheApi(
    _context: F.Context<F.Func<I, O, "AsyncFunc">>,
    input: z.infer<I>,
  ): Cache<I, O> {
    const [controller, ids] = this.getController(input);
    return [controller, input, ids];
  }
  protected override _getData(
    context: F.Context<F.Func<I, O, "AsyncFunc">>,
    cache: Cache<I, O>,
  ): T.PPromise<void> {
    if (cache[iIds] === "*") {
      return cache[iController]
        .readHashFields<ReturnType<z.infer<O>["toRecord"]>>(context, {
          fields: "*",
        })
        .then(({ $, ...result }) => {
          const value = this.outputFactory();
          for (const key in result) {
            const res = this.func.output.value.safeParse(result[key], { path: [this.func.refString("Cache:" + key)] });
            if (res.success) {
              value.add(key, res.data);
            } else {
              $ = undefined;
            }
          }
          cache[iOutput] = value;
          if ($) {
            cache[iIds] = [];
          } else {
            cache[iInput] = this.updateInput(
              cache[iInput],
              "*",
              value.getIndexs(),
            );
            cache[iIds] = "*";
          }
        });
    } else {
      if (cache[iIds].includes("$")) {
        return T.PPromise.reject(
          new Error("Cannot use $ in ids, it is a reserved keyword"),
        );
      }
      return cache[iController]
        .readHashFields<ReturnType<z.infer<O>["toRecord"]>>(context, {
          fields: cache[iIds],
        })
        .then((result) => {
          const value = this.outputFactory();
          const notFound = [];
          for (const key of cache[iIds]) {
            if (result[key] === undefined) {
              notFound.push(key);
            } else {
              const res = this.func.output.value.safeParse(result[key], { path: [this.func.refString("Cache:" + key)] });
              if (res.success) {
                value.add(key, res.data);
              } else {
                notFound.push(key);
              }
            }
          }
          cache[iOutput] = value;
          if (notFound.length) {
            cache[iInput] = this.updateInput(
              cache[iInput],
              notFound,
              value.getIndexs(),
            );
            cache[iIds] = notFound;
          } else {
            cache[iIds] = [];
          }
        });
    }
  }
  protected override _shouldInvoke(cache: Cache<I, O>): boolean {
    if (cache[iIds].length) return true;
    return false;
  }
  protected override _updatedInput(
    _context: F.Context<F.Func<I, O, "AsyncFunc">>,
    cache: Cache<I, O>,
  ): z.infer<I> {
    return cache[iInput];
  }
  protected override _setData(
    context: F.Context<F.Func<I, O, "AsyncFunc">>,
    cache: Cache<I, O>,
    output: z.infer<O>,
  ): T.PPromise<void> {
    cache[iOutput] ??= this.outputFactory();
    for (const [key, value] of output) {
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
  protected override _delCache(
    context: F.Context<F.Func<I, O, "AsyncFunc">>,
    cache: Cache<I, O>,
  ): T.PPromise<void> {
    if (cache[iIds] === "*") {
      return cache[iController].removeHashFields(context, { fields: "*" });
    } else {
      return cache[iController].removeHashFields(context, {
        fields: [...cache[iIds], "$"],
      });
    }
  }
}
