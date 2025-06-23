import type { F } from "@panth977/functions";
import { type AllowedTypes, WFGenericCache } from "./_helper.ts";
import type z from "zod/v4";
import type { CacheController } from "../exports.ts";
import type { T } from "@panth977/tools";

type Cache<I extends z.ZodType, O extends z.ZodType> = [CacheController, z.infer<I>, ...([z.infer<O>] | [])];
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
export class WFObjectCache<I extends F.FuncInput, O extends F.FuncOutput, D extends F.FuncDeclaration, Type extends AllowedTypes>
  extends WFGenericCache<Cache<I, O>, I, O, D, Type> {
  protected readonly getController: (input: z.infer<I>) => [CacheController];
  constructor({ getController, onInit }: {
    onInit?: (hook: WFObjectCache<I, O, D, Type>) => void;
    getController: (input: z.infer<I>) => [CacheController];
  }) {
    super({ onInit } as any);
    this.getController = getController;
  }
  protected override _getCacheController(_context: F.Context, input: z.core.output<I>): Cache<I, O> {
    const [controller] = this.getController(input);
    return [controller, input];
  }
  protected override _getData(context: F.Context, cache: Cache<I, O>): T.PPromise<void> {
    return cache[iController].readKeyCb<z.infer<O>>(context, {}).map((data) => {
      if (data === undefined) return;
      const value = this.func.output.parse(data);
      cache[iOutput] = value;
    });
  }
  protected override _shouldInvoke(cache: Cache<I, O>): boolean {
    if (cache.length) return true;
    return false;
  }
  protected override _updatedInput(_context: F.Context, cache: Cache<I, O>): z.core.output<I> {
    return cache[iInput];
  }
  protected override _setData(context: F.Context, cache: Cache<I, O>, output: z.core.output<O>): T.PPromise<void> {
    cache[iOutput] = output;
    return cache[iController].writeKeyCb<z.infer<O>>(context, { value: output });
  }
  protected override _convertCache(cache: Cache<I, O>): z.core.output<O> {
    if (cache[iOutput] === undefined) throw new Error("Need to gothrough the [_getData] api");
    return cache[iOutput];
  }
  protected override _delCache(context: F.Context, cache: Cache<I, O>): T.PPromise<void> {
    return cache[iController].removeKeyCb(context, {});
  }
}
