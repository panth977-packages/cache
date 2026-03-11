import type { F } from "@panth977/functions";
import { WFGenericCache } from "./_helper.ts";
import type z from "zod";
import type { CacheApi } from "../exports.ts";
import type { T } from "@panth977/tools";

type Cache<I extends z.ZodType, O extends z.ZodType> = [
  CacheApi,
  z.infer<I>,
  ...([z.infer<O>] | []),
];
const iController = 0;
const iInput = 1;
const iOutput = 2;
/**
 * ```ts
 * const cache = new MemoCacheClient({...});
 * const UserChanges = new T.PubSub(z.tuple([z.instanceof(F.Context), z.number()]));
 * const getUser = F.asyncFunc()
 *   .$input(
 *     z.number(),
 *   )
 *   .$output(
 *     z.object({ email: z.string(), name: z.string() }).nullable(),
 *   )
 *   .$wrap(
 *     new WFObjectCache({
 *       getController: (userId) => [cache.addPrefix('Users', userId)],
 *       onInit: (hook) => {
 *         UserChanges.subscribe('async', ([context, userId]) => {
 *           return hook.del(context, userId).promisified();
 *         })
 *       }
 *     }),
 *   )
 *   .$(async (context, userId) => {
 *     const result = await pg.query(`SELECT * FROM users WHERE id = ?`, [userId]);
 *     return result.rows[0] ?? null;
 *   });
 * ```
 */
export class WFObjectCache<
  I extends F.FuncInput,
  O extends F.FuncOutput,
> extends WFGenericCache<Cache<I, O>, I, O> {
  protected readonly getController: (input: z.infer<I>) => [CacheApi];
  constructor({
    getController,
    onInit,
  }: {
    onInit?: (hook: WFObjectCache<I, O>) => void;
    getController: (input: z.infer<I>) => [CacheApi];
  }) {
    super({ onInit } as any);
    this.getController = getController;
  }
  protected override _getCacheApi(
    _context: F.Context,
    input: z.infer<I>,
  ): Cache<I, O> {
    const [controller] = this.getController(input);
    return [controller, input];
  }
  protected override _getData(
    context: F.Context<F.Func<I, O, "AsyncFunc">>,
    cache: Cache<I, O>,
  ): T.PPromise<void> {
    return cache[iController].readKey<z.infer<O>>(context, {}).$then((data) => {
      if (data === undefined) return;
      const value = this.func.output.safeParse(data, { path: [this.func.refString("Cache")] });
      if (value.success) cache[iOutput] = value.data;
    });
  }
  protected override _shouldInvoke(cache: Cache<I, O>): boolean {
    if (!cache[iOutput]) return true;
    return false;
  }
  protected override _updatedInput(
    _context: F.Context,
    cache: Cache<I, O>,
  ): z.infer<I> {
    return cache[iInput];
  }
  protected override _setData(
    context: F.Context,
    cache: Cache<I, O>,
    output: z.infer<O>,
  ): T.PPromise<void> {
    cache[iOutput] = output;
    return cache[iController].writeKey<z.infer<O>>(context, { value: output });
  }
  protected override _convertCache(cache: Cache<I, O>): z.infer<O> {
    if (cache[iOutput] === undefined) {
      throw new Error("Need to gothrough the [_getData] api");
    }
    return cache[iOutput];
  }
  protected override _delCache(
    context: F.Context,
    cache: Cache<I, O>,
  ): T.PPromise<void> {
    return cache[iController].removeKey(context, {});
  }
}
