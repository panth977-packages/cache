import type { F } from "@panth977/functions";
import { type AllowedTypes, VoidFn, WFGenericCache } from "./_helper.ts";
import type z from "zod/v4";
import type { CacheController } from "../exports.ts";
import { T } from "@panth977/tools";

type Output = T.zPreIndexedStructure<any, any>;
type Cache<I extends z.ZodType, O extends Output> = [CacheController, z.infer<I>, Idx<O>[], ...([z.infer<O>] | [])];
const iController = 0;
const iInput = 1;
const iIds = 2;
const iOutput = 3;
type Idx<O extends Output> = ReturnType<z.infer<O>["getIndexs"]>[number];
type Value<O extends Output> = ReturnType<z.infer<O>["get"]>;
/**
 * ```ts
 * const cache = new MemoCacheClient({...});
 * const UserChanges = new T.PubSub(z.tuple([z.instanceof(F.Context), z.number()]));
 * const getUsers = F.asyncFunc()
 *   .$input(
 *     z.number().array(),
 *   )
 *   .$output(
 *     T.zPreIndexedStructure(
 *       z.number(),
 *       z.object({ id: z.number(), email: z.string(), name: z.string() }),
 *     ),
 *   )
 *   .$wrap(
 *     new WFMultiObjectCache({
 *       getController: (userIds) => [cache.addPrefix("Users"), userIds],
 *       updateInput: (_input, notFound) => notFound,
 *       onInit: (hook) => {
 *         UserChanges.subscribe('cb', ([context, userId], cb) => {
 *           hook.del(context, [userId]).finally(cb);
 *         })
 *       }
 *     }),
 *   )
 *   .$(async (context, userIds) => {
 *     type User = { id: number; email: string; name: string };
 *     const result = await pg.query(`SELECT * FROM users WHERE id IN (${new Array(userIds.length).fill("?")})`, userIds);
 *     const data = new T.IndexKeyOneToOne(result.rows as User[], T.AccessKey("id"));
 *     return data.toPreIndexed();
 *   });
 * ```
 */
export class WFMultiObjectCache<
  I extends F.FuncInput,
  O extends Output,
  D extends F.FuncDeclaration,
  Type extends AllowedTypes,
> extends WFGenericCache<Cache<I, O>, I, O, D, Type> {
  protected readonly getController: (input: z.infer<I>) => [CacheController, Idx<O>[]];
  protected readonly updateInput: (input: z.infer<I>, notFoundIds: Idx<O>[]) => z.infer<I>;
  constructor(
    { getController, updateInput, onInit }: {
      onInit?: (hook: WFMultiObjectCache<I, O, D, Type>) => void;
      getController: (input: z.infer<I>) => [CacheController, Idx<O>[]];
      updateInput: (input: z.infer<I>, notFoundIds: Idx<O>[]) => z.infer<I>;
    },
  ) {
    super({ onInit } as any);
    this.getController = getController;
    this.updateInput = updateInput;
  }
  private outputFactory(): z.infer<O> {
    return new T.PreIndexedStructure(0, [], []) as z.infer<O>;
  }
  protected override _getCacheController(_context: F.Context, input: z.core.output<I>): Cache<I, O> {
    const [controller, ids] = this.getController(input);
    return [controller, input, ids];
  }
  protected override _getData(context: F.Context, cache: Cache<I, O>): T.PPromise<void> {
    if (cache[iIds].length === 0) {
      cache[iOutput] = this.outputFactory();
      return T.PPromise.resolve<void>(undefined);
    }
    return T.PPromise
      .all(cache[iIds].map((id) => cache[iController].readKeyCb<Value<O>>(context, { key: id })))
      .map((vals) => {
        let data = this.outputFactory();
        const notFoundIds = [];
        for (let i = 0; i < cache[iIds].length; i++) {
          if (vals[i] === undefined) {
            notFoundIds.push(cache[iIds][i]);
          } else {
            data.add(cache[iIds][i], vals[i]);
          }
        }
        data = this.func.output.parse(data);
        cache[iInput] = this.updateInput(cache[iInput], notFoundIds);
      });
  }
  protected override _shouldInvoke(cache: Cache<I, O>): boolean {
    if (cache[iOutput] === undefined) return true;
    if (cache[iIds].length) return true;
    return false;
  }
  protected override _updatedInput(_context: F.Context, cache: Cache<I, O>): z.core.output<I> {
    return cache[iInput];
  }
  protected override _setData(context: F.Context, cache: Cache<I, O>, output: z.core.output<O>): T.PPromise<void> {
    cache[iOutput] ??= this.outputFactory();
    const updates = [];
    for (const [id, val] of output) {
      cache[iOutput].set(id, val);
      updates.push(cache[iController].writeKeyCb(context, { key: id, value: val }));
    }
    return T.PPromise.all(updates).map(VoidFn);
  }
  protected override _convertCache(cache: Cache<I, O>): z.core.output<O> {
    if (cache[iOutput] === undefined) throw new Error("Need to gothrough the [_getData] api");
    return cache[iOutput];
  }
  protected override _delCache(context: F.Context, cache: Cache<I, O>): T.PPromise<void> {
    const [controller, ids] = this.getController(cache[iInput]);
    const updates = [];
    for (const id of ids) {
      updates.push(controller.removeKeyCb(context, { key: id }));
    }
    return T.PPromise.all(updates).map(VoidFn);
  }
}
