import type { F } from "@panth977/functions";
import { VoidFn, WFGenericCache } from "./_helper.ts";
import type z from "zod";
import type { CacheApi } from "../exports.ts";
import { T } from "@panth977/tools";

type Output = T.zPreIndexedStructure<z.ZodType, z.ZodType>;
type Cache<I extends z.ZodType, O extends Output> = [
  CacheApi,
  z.infer<I>,
  Idx<O>[],
  ...([z.infer<O>] | []),
];
const iController = 0;
const iInput = 1;
const iIds = 2;
const iOutput = 3;
type Idx<O extends Output> = ReturnType<z.infer<O>["getIndexs"]>[number];
type Value<O extends Output> = ReturnType<z.infer<O>["get"]>;
/**
 * ```ts
 * const cache = new MemoCacheClient({...});
 * const UserChanges = new T.PubSub(z.tuple([z.instanceof(F.Context<F.Func<I, O, 'AsyncFunc'>>), z.number()]));
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
 *         UserChanges.subscribe(([context, userId]) => hook.del(context, [userId]))
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
> extends WFGenericCache<Cache<I, O>, I, O> {
  protected readonly getController: (input: z.infer<I>) => [CacheApi, Idx<O>[]];
  protected readonly updateInput: (
    input: z.infer<I>,
    notFoundIds: Idx<O>[],
  ) => z.infer<I>;
  constructor({
    getController,
    updateInput,
    onInit,
  }: {
    onInit?: (hook: WFMultiObjectCache<I, O>) => void;
    getController: (input: z.infer<I>) => [CacheApi, Idx<O>[]];
    updateInput: (input: z.infer<I>, notFoundIds: Idx<O>[]) => z.infer<I>;
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
  ): Promise<void> {
    if (cache[iIds].length === 0) {
      cache[iOutput] = this.outputFactory();
      return Promise.resolve<void>(undefined);
    }
    return Promise.all(
      cache[iIds].map((id) =>
        cache[iController].readKey<Value<O>>(context, { key: id }),
      ),
    ).then((vals) => {
      const data = this.outputFactory();
      const notFoundIds = [];
      for (let i = 0; i < cache[iIds].length; i++) {
        if (vals[i] === undefined) {
          notFoundIds.push(cache[iIds][i]);
        } else {
          const value = this.func.output.value.safeParse(vals[i], {
            path: [this.func.refString("Cache:" + cache[iIds][i])],
          });
          if (value.success) {
            data.add(cache[iIds][i], value.data);
          } else {
            notFoundIds.push(cache[iIds][i]);
          }
        }
      }
      cache[iOutput] = data;
      cache[iInput] = this.updateInput(cache[iInput], notFoundIds);
    });
  }
  protected override _shouldInvoke(cache: Cache<I, O>): boolean {
    if (cache[iOutput] === undefined) return true;
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
  ): Promise<void> {
    cache[iOutput] ??= this.outputFactory();
    const updates = [];
    for (const [id, val] of output) {
      cache[iOutput].set(id, val);
      updates.push(
        cache[iController].writeKey(context, { key: id, value: val }),
      );
    }
    return Promise.all(updates).then(VoidFn);
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
  ): Promise<void> {
    const [controller, ids] = this.getController(cache[iInput]);
    const updates = [];
    for (const id of ids) {
      updates.push(controller.removeKey(context, { key: id }));
    }
    return Promise.all(updates).then(VoidFn);
  }
}
