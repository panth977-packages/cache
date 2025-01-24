/**
 * Exports all the Object cache Hooks (one to one relation)
 * @module
 */
import type { z } from "zod";
import type { FUNCTIONS } from "@panth977/functions";
import type {
  AbstractCacheClient,
  CacheController,
  KEY,
} from "../controller.ts";
import {
  bundleCached,
  extractFromPromise,
  Hook,
  type SyncOrPromise,
  type zKEY,
} from "./_helper.ts";

export type SingleObjectInfo = { found: boolean };
export type MultipleObjectInfo<Id extends KEY> = {
  found: Id[];
  notFound: Id[];
};
/**
 * @example
 *
 * ```ts
 * const getUser = FUNCTIONS.AsyncFunction.build({
 *   input: z.object({ userId: z.number() }),
 *   output: z.object({ name: z.string(), address: z.string() }).optional(),
 *   wrappers: (_params) => [
 *     CACHE.Wrapper({
 *       _params,
 *       getHook: ({context, input: {userId}}) =>
 *         new CACHE.HOOKS.SingleObject({
 *           context,
 *           cache: cache.addPrefix(`UserId:${userId}`),
 *           schema: _params.output
 *         }),
 *     }),
 *   ],
 *   async func({context, input: {userId}}) {
 *     if (!userId.length) return {};
 *     const result = await pg.query(`SELECT name, address FROM users WHERE id = ${userId} LIMIT 1`);
 *     const user = result.rows[0];
 *     return user ?? undefined;
 *   },
 * });
 * // UPDATE OR DELETE CACHE
 * const hook = getUser.wrappers[0].getHook({context, input: { userId: user.id }});
 * await hook.set({output: { name: user.name, address: user.address }});
 * await hook.del({});
 * ```
 */ export class SingleObject<
  A extends AbstractCacheClient,
  O extends z.ZodType
> extends Hook<SingleObjectInfo, O> {
  readonly cache: CacheController<A>;
  private get elementSchema() {
    const schema = this.schema;
    if (!schema) throw new Error("Don't have schema!");
    return schema;
  }
  constructor({
    cache,
    context,
    schema,
  }: {
    context?: FUNCTIONS.Context;
    cache: CacheController<A>;
    schema?: O;
  }) {
    super(context, schema);
    this.cache = cache;
  }
  override isIncomplete({ info }: { info: SingleObjectInfo }): boolean {
    return !info.found;
  }
  override async exists(): Promise<SingleObjectInfo> {
    const exists = await this.cache.existsKey({ context: this.context });
    return { found: exists };
  }
  override async get({
    safe,
  }: {
    safe?: boolean;
  }): Promise<{ val: z.TypeOf<O>; info: SingleObjectInfo }> {
    const res =
      (await this.cache.readKey<z.infer<O>>({ context: this.context })) ??
      undefined;
    let val = res;
    if (safe) val = this.elementSchema.safeParse(val).data;
    return {
      val,
      info: { found: val !== undefined },
    };
  }
  override async set({
    output,
    ifExists,
  }: {
    output: SyncOrPromise<z.TypeOf<O>>;
    ifExists?: boolean;
  }): Promise<void> {
    if (ifExists) {
      const data = await this.exists();
      if (!data.found) return;
    }
    await this.cache.writeKey({ context: this.context, value: output });
  }
  override async del(): Promise<void> {
    await this.cache.removeKey({ context: this.context });
  }
  override merge({
    extension,
    target,
  }: {
    target: z.TypeOf<O>;
    extension: z.TypeOf<O>;
  }): z.TypeOf<O> {
    return target ?? extension;
  }
}

/**
 * @example
 * ```ts
 * const getUsers = FUNCTIONS.AsyncFunction.build({
 *   input: z.object({ userIds: z.number().array() }),
 *   output: z.record(z.number(), z.object({ id: z.number(), name: z.string(), address: z.string() })),
 *   wrappers: (_params) => [
 *     CACHE.Wrapper({
 *       _params,
 *       getHook: ({context, input: { userIds }}) =>
 *         new CACHE.HOOKS.MultipleObject({
 *           context,
 *           cache: cache.addPrefix(`UserId`),
 *           schema: _params.output,
 *           ids: userIds
 *         }),
 *       updateInput: ({info}) => ({ userIds: info }),
 *       useHook(Hooks) {
 *         // UPDATE OR DELETE CACHE
 *         const hook = Hooks({context, input: { userIds: [user.id] }});
 *         await hook.set({output: { [user.id]: { id: user.id, name: user.name, address: user.address } }});
 *         await hook.del({});
 *       },
 *     }),
 *   ],
 *   async func({context, input: {userIds}}) {
 *     const result = await pg.query(`SELECT id, name, address FROM users WHERE id IN (${userIds.join(', ')}) LIMIT 1`);
 *     const users = result.rows;
 *     return TOOLS.oneToOneMapping(users, 'id');
 *   },
 * });
 * ```
 */ export class MultipleObject<
  A extends AbstractCacheClient,
  O extends z.ZodType,
  Id extends zKEY
> extends Hook<MultipleObjectInfo<z.infer<Id>>, z.ZodRecord<Id, O>> {
  readonly cache: CacheController<A>;
  private get elementSchema() {
    const schema = this.schema;
    if (!schema) throw new Error("Don't have schema!");
    return schema.valueSchema;
  }
  // private get idSchema() {
  //   const schema = this.schema;
  //   if (!schema) throw new Error("Don't have schema!");
  //   return schema.keySchema;
  // }
  readonly ids: z.infer<Id>[];
  constructor({
    context,
    cache,
    schema,
    ids,
  }: {
    context?: FUNCTIONS.Context;
    cache: CacheController<A>;
    schema?: z.ZodRecord<Id, O>;
    ids: z.infer<Id>[];
  }) {
    ids = [...new Set(ids)];
    super(context, schema);
    this.cache = cache;
    this.ids = ids;
  }
  override isIncomplete({
    info,
  }: {
    info: MultipleObjectInfo<z.infer<Id>>;
  }): boolean {
    return info.notFound.length !== 0;
  }
  override async exists(): Promise<MultipleObjectInfo<z.infer<Id>>> {
    const info = await Promise.all(
      this.ids.map((id) =>
        this.cache
          .existsKey({ context: this.context, key: id })
          .then((exists) => ({ id, found: exists }))
      )
    );
    return {
      found: info.filter((x) => x.found).map((x) => x.id),
      notFound: info.filter((x) => !x.found).map((x) => x.id),
    };
  }
  override async get({ safe }: { safe?: boolean }): Promise<{
    val: Record<z.infer<Id>, O["_output"]>;
    info: MultipleObjectInfo<z.infer<Id>>;
  }> {
    const res = await Promise.all(
      this.ids.map((x) =>
        this.cache.readKey<z.infer<O>>({ context: this.context, key: x })
      )
    );
    const val = bundleCached(this.ids, res);
    if (safe) {
      for (const id in val) {
        val[id] = this.elementSchema.safeParse(val[id]).data;
        if (val[id] === undefined) delete val[id];
      }
    }
    return {
      val,
      info: {
        found: this.ids.filter((id) => val[id] !== undefined),
        notFound: this.ids.filter((id) => val[id] === undefined),
      },
    };
  }
  override async set({
    output,
    ifExists,
  }: {
    output: SyncOrPromise<Record<z.infer<Id>, O["_output"]>>;
    ifExists?: boolean;
  }): Promise<void> {
    let recordedOutput: Record<z.infer<Id>, SyncOrPromise<z.infer<O>>>;
    if (output instanceof Promise) {
      const promise = output;
      recordedOutput = extractFromPromise(this.ids, promise);
    } else {
      recordedOutput = output;
    }
    if (ifExists) {
      const data = await this.exists();
      for (const x of data.notFound) delete recordedOutput[x];
    }
    await Promise.all(
      Object.keys(recordedOutput).map((x) =>
        this.cache.writeKey({
          context: this.context,
          key: x,
          value: recordedOutput[x as z.TypeOf<Id>],
        })
      )
    );
  }
  override async del(): Promise<void> {
    await Promise.all(
      this.ids.map((x) =>
        this.cache.removeKey({ context: this.context, key: x })
      )
    );
  }
  override merge({
    extension,
    target,
  }: {
    target: Record<z.infer<Id>, O["_output"]>;
    extension: Record<z.infer<Id>, O["_output"]>;
  }): Record<z.infer<Id>, O["_output"]> {
    return Object.assign(target, extension);
  }
}
