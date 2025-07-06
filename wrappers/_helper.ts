import { F } from "@panth977/functions";
import { T } from "@panth977/tools";
import type { z } from "zod/v4";

export type AllowedTypes = Extract<F.FuncTypes, "AsyncFunc" | "AsyncCb">;
export abstract class WFGenericCache<C, I extends F.FuncInput, O extends F.FuncOutput, Type extends AllowedTypes>
  extends F.GenericFuncWrapper<I, O, Type> {
  private Hook?: (hook: this) => void;
  private _func?: F.Func<I, O, Type>;
  constructor({ onInit }: { onInit?: (hook: WFGenericCache<C, I, O, Type>) => void }) {
    super();
    this.Hook = onInit;
  }
  protected get func(): F.Func<I, O, Type> {
    if (!this._func) throw new Error("Function not initialized");
    return this._func;
  }
  override optimize(func: F.Func<I, O, Type>): void {
    this._func = func;
    super.optimize(func);
    this.Hook?.(this);
    delete this.Hook;
  }
  protected override SyncFunc: undefined;
  protected override StreamFunc: undefined;
  protected abstract _getCacheController(context: F.Context, input: z.infer<I>): C;
  protected abstract _getData(context: F.Context, cache: C): T.PPromise<void>;
  protected abstract _shouldInvoke(cache: C): boolean;
  protected abstract _updatedInput(context: F.Context, cache: C): z.infer<I>;
  protected abstract _setData(context: F.Context, cache: C, output: z.infer<O>): T.PPromise<void>;
  protected abstract _delCache(context: F.Context, cache: C): T.PPromise<void>;
  protected abstract _convertCache(cache: C): z.core.output<O>;
  get(context: F.Context, input: z.core.output<I>): T.PPromise<z.core.output<O>> {
    const cache = this._getCacheController(context, input);
    return this._getData(context, cache).map(this._convertCache.bind(this, cache));
  }
  set(context: F.Context, input: z.core.output<I>, output: z.core.output<O>): T.PPromise<void> {
    const cache = this._getCacheController(context, input);
    return this._setData(context, cache, output);
  }
  del(context: F.Context, input: z.core.output<I>): T.PPromise<void> {
    const cache = this._getCacheController(context, input);
    return this._delCache(context, cache);
  }
  protected override AsyncFunc(
    invokeStack: F.FuncInvokeStack<I, O, "AsyncFunc">,
    context: F.Context<F.Func<I, O, "AsyncFunc">>,
    input: z.core.output<I>,
  ): T.PPromise<z.core.output<O>> {
    const cache = this._getCacheController(context, input);
    return this._getData(context, cache).map(() => {
      if (!this._shouldInvoke(cache)) {
        return T.PPromise.resolve(this._convertCache(cache));
      }
      input = this._updatedInput(context, cache);
      const result = invokeStack.$(context, input).then((output) => {
        this._setData(context, cache, output);
        return this._convertCache(cache);
      });
      return result;
    });
  }
}
export function VoidFn() {}
