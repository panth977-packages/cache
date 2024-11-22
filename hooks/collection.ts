/**
 * Exports all the Collection cache Hooks (one to many relation)
 * @module
 */
import type { FUNCTIONS } from "@panth977/functions";
import type { z } from "zod";
import type {
  AbstractCacheClient,
  AllFields,
  CacheController,
  KEY,
} from "../controller.ts";
import {
  bundleCached,
  Hook,
  type SyncOrPromise,
  type zKEY,
} from "./_helper.ts";
export type SingleCollectionInfo<SubId extends KEY> = {
  found: SubId[];
  notFound: AllFields | SubId[];
};
export type MultipleCollectionInfo<Id extends KEY, SubId extends KEY> = {
  id: Id;
  found: SubId[];
  notFound: AllFields | SubId[];
}[];

/**
 * @example
 * ```ts
 * const getUsersOfOrg = FUNCTIONS.AsyncFunction.build({
 *   input: z.object({
 *     orgId: z.string(),
 *     userIds: z.union([z.literal('*'), z.number().array()]),
 *     // this will be set from cache layer
 *     ignoreUserId: z.number().array().optional()
 *   }),
 *   output: z.record(z.number(), z.object({ id: z.number(), name: z.string(), address: z.string() })),
 *   wrappers: (params) => [
 *     CACHE.Wrapper(params, {
 *       getHook: (context, { orgId, userIds }) =>
 *         new CACHE.HOOKS.SingleCollection(
 *           context,
 *           cache.addPrefix(`OrgId:${orgId}:UserId`),
 *           params.output,
 *           userIds
 *         ),
 *       updateInfo: (_context, { orgId }, info) => ({
 *         userIds: info.notFound,
 *         ignoreUserId: info.found,
 *         orgId,
 *       }),
 *       useHook(Hooks) {
 *         const hook = Hooks(context, { userIds: '*' });
 *         await hook.set({ [user.id]: { id: user.id, name: user.name, address: user.address } });
 *         await hook.del();
 *       },
 *     }),
 *   ],
 *   async func(context, {orgId, userIds, ignoreUserId}) {
 *     if (!userIds.length) return {};
 *     const result = await pg.query(`
 *         SELECT id, name, address
 *         FROM users
 *         WHERE orgId = '${orgId}'
 *             ${userIds === '*' ? '' : `AND id IN (${userIds.join(', ')})`}
 *             ${!ignoreUserId?.length ? '' : `AND id NOT IN (${ignoreUserId.join(', ')})`}
 *         `);
 *     const users = result.rows;
 *     return TOOLS.oneToOneMapping(users, 'id');
 *   },
 * });
 * ```
 */ export class SingleCollection<
  A extends AbstractCacheClient,
  O extends z.ZodType,
  SubId extends zKEY
> extends Hook<SingleCollectionInfo<z.infer<SubId>>, z.ZodRecord<SubId, O>> {
  readonly cache: CacheController<A>;
  readonly schema: O;
  readonly subIdSchema: SubId;
  readonly subIds: z.infer<SubId>[] | AllFields;
  constructor(
    context: FUNCTIONS.Context,
    cache: CacheController<A>,
    schema: z.ZodRecord<SubId, O>,
    subIds: z.infer<SubId>[] | AllFields
  ) {
    if (Array.isArray(subIds)) {
      if (subIds.includes("$")) {
        throw new Error("Cannot use subId [$] as it is reserved keyword!");
      }
      if (new Set(subIds).size !== subIds.length) {
        throw new Error("Same [subId] was passed more than once");
      }
    }
    super(context);
    this.cache = cache;
    this.schema = schema.valueSchema;
    this.subIdSchema = schema.keySchema;
    this.subIds = subIds;
  }
  override isIncomplete(info: SingleCollectionInfo<z.infer<SubId>>): boolean {
    return info.notFound === "*" || info.notFound.length !== 0;
  }
  override async exists(): Promise<SingleCollectionInfo<z.infer<SubId>>> {
    const { $, ...res } = await this.cache.existsHashFields(this.context, {
      fields: this.subIds,
    });
    const found =
      this.subIds !== "*"
        ? this.subIds.filter((x) => res[x])
        : Object.keys(res)
            .filter((x) => res[x])
            .map((x) => this.subIdSchema.safeParse(x))
            .filter((x) => x.success)
            .map((x) => x.data);
    const notFound =
      this.subIds !== "*" ? this.subIds.filter((x) => !res[x]) : $ ? [] : "*";
    return { found, notFound };
  }
  override async get(safe?: boolean): Promise<{
    val: Record<z.infer<SubId>, O["_output"]>;
    info: SingleCollectionInfo<z.infer<SubId>>;
  }> {
    const res = await this.cache.readHashFields(this.context, {
      fields: this.subIds,
    });
    let $: any = res.$;
    delete res.$;
    const val: Record<KEY, any> = res ?? {};
    if (safe) {
      for (const subId in val) {
        val[subId] = this.schema.safeParse(val[subId]).data ?? undefined;
        if (val[subId] === undefined) {
          delete val[subId];
          $ = undefined;
        }
      }
    }
    const found =
      this.subIds !== "*"
        ? this.subIds.filter((x) => res[x])
        : Object.keys(res)
            .filter((x) => x in res)
            .map((x) => this.subIdSchema.safeParse(x))
            .filter((x) => x.success)
            .map((x) => x.data);
    const notFound =
      this.subIds !== "*"
        ? this.subIds.filter((x) => !(x in res))
        : $ === "*"
        ? []
        : "*";
    return { val, info: { found, notFound } };
  }
  override async set(
    output: SyncOrPromise<Record<z.infer<SubId>, O["_output"]>>,
    ifExists?: boolean
  ): Promise<void> {
    let recordedOutput: Record<KEY, SyncOrPromise<z.infer<O>>> = {};
    if (this.subIds !== "*") {
      if (output instanceof Promise) {
        const promise = output;
        recordedOutput = Object.fromEntries(
          this.subIds.map((x) => [x, promise.then((data) => data[x])])
        );
      } else {
        recordedOutput = { ...output };
      }
    }
    if (ifExists) {
      const data = await this.exists();
      if (this.subIds === "*") {
        if (data.notFound === "*") {
          await this.cache.removeHashFields(this.context, {});
          return;
        }
      } else {
        const data = await this.exists();
        for (const subId of data.notFound) delete recordedOutput[subId];
      }
    }
    if (this.subIds === "*") {
      await this.cache.removeHashFields(this.context, {});
      const awaitedOutput = await output;
      await this.cache.writeHashFields(this.context, {
        value: { ...awaitedOutput, $: "*" },
      });
    } else {
      await this.cache.writeHashFields(this.context, { value: recordedOutput });
    }
  }
  override async del() {
    if (this.subIds === "*") {
      await this.cache.removeHashFields(this.context, {});
    } else {
      await this.cache.removeHashFields(this.context, {
        fields: [...this.subIds, "$"],
      });
    }
  }
  override merge(
    target: Record<z.infer<SubId>, O["_output"]>,
    extension: Record<z.infer<SubId>, O["_output"]>
  ): Record<z.infer<SubId>, O["_output"]> {
    return Object.assign(target, extension);
  }
}
/**
 * @example
 * ```ts
 * const getUsersOfOrgs = FUNCTIONS.AsyncFunction.build({
 *     input: z.object({
 *       orgId: z.string(),
 *       userIds: z.union([z.literal('*'), z.number().array()]),
 *       // this will be set from cache layer
 *       ignoreUserId: z.number().array().optional()
 *     }).array(),
 *     output: z.record(
 *       z.string(),
 *       z.record(
 *         z.number(),
 *         z.object({ orgId: z.string(), userId: z.number(), name: z.string(), address: z.string() })
 *       )
 *     ),
 *     wrappers: (params) => [
 *       CACHE.Wrapper(params, {
 *         getHook: (context, input) =>
 *           new CACHE.HOOKS.MultipleCollection(
 *             context,
 *             cache.addPrefix(`OrgId`),
 *             params.output,
 *             input.map(x => ({id: x.orgId, subIds: x.userIds}))
 *           ),
 *         updateInfo: (_context, _input, info) => info.filter(x => x.notFound.length).map(x => ({
 *             orgId: x.id,
 *             userIds: x.notFound,
 *             ignoreUserId: x.found,
 *         })),
 *       }),
 *     ],
 *     async func(context, input) {
 *       if (!input.length) return {};
 *       const result = await pg.query(YourOptimizedQuery);
 *       const users = result.rows;
 *       return TOOLS.oneToOneToOneMapping(users, 'orgId', 'userId');
 *     },
 * });
 * ```
 */ export class MultipleCollection<
  A extends AbstractCacheClient,
  O extends z.ZodType,
  Id extends zKEY,
  SubId extends zKEY
> extends Hook<
  MultipleCollectionInfo<z.infer<Id>, z.infer<SubId>>,
  z.ZodRecord<Id, z.ZodRecord<SubId, O>>
> {
  readonly cache: CacheController<A>;
  readonly schema: O;
  readonly idSchema: Id;
  readonly subIdSchema: SubId;
  readonly locs: { id: z.infer<Id>; subIds: z.infer<SubId>[] | AllFields }[];
  constructor(
    context: FUNCTIONS.Context,
    cache: CacheController<A>,
    schema: z.ZodRecord<Id, z.ZodRecord<SubId, O>>,
    locs: { id: z.infer<Id>; subIds: z.infer<SubId>[] | AllFields }[]
  ) {
    if (new Set(locs.map((x) => x.id)).size !== locs.length) {
      throw new Error("Same [id] was passed more than once");
    }
    for (const x of locs) {
      if (Array.isArray(x.subIds)) {
        if (x.subIds.includes("$")) {
          throw new Error("Cannot use subId [$] as it is reserved keyword!");
        }
        if (new Set(x.subIds).size !== x.subIds.length) {
          throw new Error("Same [subId] was passed more than once");
        }
      }
    }
    super(context);
    this.cache = cache;
    this.idSchema = schema.keySchema;
    this.subIdSchema = schema.valueSchema.keySchema;
    this.schema = schema.valueSchema.valueSchema;
    this.locs = locs;
  }
  override isIncomplete(
    info: MultipleCollectionInfo<z.infer<Id>, z.infer<SubId>>
  ): boolean {
    for (const e of info) {
      if (e.notFound === "*" || e.notFound.length !== 0) return true;
    }
    return false;
  }
  override async exists(): Promise<
    MultipleCollectionInfo<z.infer<Id>, z.infer<SubId>>
  > {
    const info = await Promise.all(
      this.locs.map((x) =>
        this.cache
          .existsHashFields(this.context, { key: x.id, fields: x.subIds })
          .then(({ $, ...res }) => ({
            id: x.id,
            found:
              x.subIds !== "*"
                ? x.subIds.filter((x) => res[x])
                : Object.keys(res)
                    .filter((x) => res[x])
                    .map((x) => this.subIdSchema.safeParse(x))
                    .filter((x) => x.success)
                    .map((x) => x.data as z.infer<SubId>),
            notFound:
              x.subIds !== "*"
                ? x.subIds.filter((x) => !res[x])
                : $
                ? []
                : ("*" as const),
          }))
      )
    );
    return info;
  }
  override async get(safe?: boolean): Promise<{
    val: Record<z.infer<Id>, Record<z.infer<SubId>, O["_output"]>>;
    info: MultipleCollectionInfo<z.infer<Id>, z.infer<SubId>>;
  }> {
    const res = await Promise.all(
      this.locs.map((x) =>
        this.cache.readHashFields(this.context, { key: x.id, fields: x.subIds })
      )
    );
    const val = bundleCached(
      this.locs.map((x) => x.id),
      res.map((x) => x ?? {}) as Record<KEY, z.infer<O>>[]
    );
    const $: Record<KEY, any> = {};
    if (safe) {
      for (const id in val) {
        $[id] = val[id].$;
        delete val[id].$;
        for (const subId in val[id]) {
          val[id][subId] =
            this.schema.safeParse(val[id][subId]).data ?? undefined;
          if (val[id][subId] === undefined) {
            delete val[id][subId];
            delete $[id];
          }
        }
      }
    }
    const info = this.locs.map((x) => ({
      id: x.id,
      found:
        x.subIds !== "*"
          ? x.subIds.filter((x) => x in val)
          : Object.keys(res)
              .map((x) => this.subIdSchema.safeParse(x))
              .filter((x) => x.success)
              .map((x) => x.data as z.infer<SubId>),
      notFound:
        x.subIds !== "*"
          ? x.subIds.filter((x) => !(x in val))
          : $
          ? []
          : ("*" as const),
    }));
    return { val, info };
  }
  override async set(
    output: SyncOrPromise<
      Record<z.infer<Id>, Record<z.infer<SubId>, O["_output"]>>
    >,
    ifExists?: boolean
  ): Promise<void> {
    const fullOutput: Record<KEY, SyncOrPromise<Record<KEY, z.infer<O>>>> = {};
    const partialOutput: Record<
      KEY,
      Record<KEY, SyncOrPromise<z.infer<O>>>
    > = {};
    if (output instanceof Promise) {
      for (const loc of this.locs) {
        if (loc.subIds === "*") {
          fullOutput[loc.id] = output.then((data) => data[loc.id]);
        } else {
          partialOutput[loc.id] = Object.fromEntries(
            loc.subIds.map((x) => [x, output.then((data) => data[loc.id][x])])
          );
        }
      }
    } else {
      for (const loc of this.locs) {
        if (loc.subIds === "*") {
          fullOutput[loc.id] = output[loc.id];
        } else {
          partialOutput[loc.id] = Object.fromEntries(
            loc.subIds.map((x) => [x, output[loc.id][x]])
          );
        }
      }
    }
    if (ifExists) {
      const data = await this.exists();
      const needToDel: KEY[] = [];
      for (const loc of data) {
        if (loc.notFound === "*") {
          needToDel.push(loc.id);
          delete fullOutput[loc.id];
        } else {
          for (const subId of loc.notFound) {
            delete partialOutput[loc.id][subId];
          }
        }
      }
      await Promise.all(
        needToDel.map((x) =>
          this.cache.removeHashFields(this.context, { key: x })
        )
      );
    }
    await Promise.all([
      Promise.all(
        this.locs
          .filter((x) => x.subIds !== "*")
          .map((x) =>
            this.cache.writeHashFields(this.context, {
              key: x.id,
              value: partialOutput[x.id],
            })
          )
      ),
      Promise.all(
        Object.keys(fullOutput).map(
          async (x) => [x, await fullOutput[x]] as const
        )
      )
        .then((x) => Object.fromEntries(x))
        .then((res) =>
          Promise.all(
            Object.keys(res).map((x) =>
              this.cache.writeHashFields(this.context, {
                key: x,
                value: { ...res[x], $: "*" },
              })
            )
          )
        ),
    ]);
  }
  override async del(): Promise<void> {
    await Promise.all(
      this.locs.map((x) =>
        this.cache.removeHashFields(this.context, {
          key: x.id,
          fields: x.subIds,
        })
      )
    );
  }
  override merge(
    target: Record<z.infer<Id>, Record<z.infer<SubId>, O["_output"]>>,
    extension: Record<z.infer<Id>, Record<z.infer<SubId>, O["_output"]>>
  ): Record<z.infer<Id>, Record<z.infer<SubId>, O["_output"]>> {
    for (const id in extension) {
      Object.assign(
        (target[id as z.infer<Id>] ??= {} as Record<
          z.infer<SubId>,
          O["_output"]
        >),
        extension[id as z.infer<Id>]
      );
    }
    return target;
  }
}
