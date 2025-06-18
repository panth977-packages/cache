import { F } from "@panth977/functions";
import type { z } from "zod/v4";

export type AllowedTypes = Extract<F.FuncTypes, "AsyncFunc" | "AsyncCb">;
export abstract class WFGenericCache<C, I extends F.FuncInput, O extends F.FuncOutput, D extends F.FuncDeclaration, Type extends AllowedTypes>
  extends F.GenericFuncWrapper<I, O, D, Type> {
  private Hook?: (hook: this) => void;
  private _func?: F.Func<I, O, D, Type>;
  constructor({ onInit }: { onInit?: (hook: WFGenericCache<C, I, O, D, Type>) => void }) {
    super();
    this.Hook = onInit;
  }
  protected get func(): F.Func<I, O, D, Type> {
    if (!this._func) throw new Error("Function not initialized");
    return this._func;
  }
  override optimize(func: F.Func<I, O, D, Type>): void {
    this._func = func;
    super.optimize(func);
    this.Hook?.(this);
    delete this.Hook;
  }
  protected override SyncFunc: undefined;
  protected override SubsCb: undefined;
  protected abstract _getCacheController(context: F.Context, input: z.infer<I>): C;
  protected abstract _getData(context: F.Context, cache: C): F.AsyncCbReceiver<void>;
  protected abstract _shouldInvoke(cache: C): boolean;
  protected abstract _updatedInput(context: F.Context, cache: C): z.infer<I>;
  protected abstract _setData(context: F.Context, cache: C, output: z.infer<O>): F.AsyncCbReceiver<void>;
  protected abstract _delCache(context: F.Context, cache: C): F.AsyncCbReceiver<void>;
  protected abstract _convertCache(cache: C): z.core.output<O>;
  get(context: F.Context, input: z.core.output<I>): F.AsyncCbReceiver<z.core.output<O>> {
    const cache = this._getCacheController(context, input);
    return this._getData(context, cache).pipeThen(this._convertCache.bind(this, cache));
  }
  set(context: F.Context, input: z.core.output<I>, output: z.core.output<O>): F.AsyncCbReceiver<void> {
    const cache = this._getCacheController(context, input);
    return this._setData(context, cache, output);
  }
  del(context: F.Context, input: z.core.output<I>): F.AsyncCbReceiver<void> {
    const cache = this._getCacheController(context, input);
    return this._delCache(context, cache);
  }
  protected override AsyncFunc(
    invokeStack: F.FuncInvokeStack<I, O, D, "AsyncFunc">,
    context: F.Context<F.Func<I, O, D, "AsyncFunc">>,
    input: z.core.output<I>,
  ): Promise<z.core.output<O>> {
    const cache = this._getCacheController(context, input);
    return this._getData(context, cache).pipeCatch(VoidFn).pipe(() => {
      if (!this._shouldInvoke(cache)) {
        return F.AsyncCbReceiver.value(this._convertCache(cache));
      }
      input = this._updatedInput(context, cache);
      return F.AsyncCbReceiver.fromPromise(invokeStack.$(context, input)).pipeThen((output) => {
        this._setData(context, cache, output).pipeCatch(VoidFn);
        return this._convertCache(cache);
      });
    }).promisified();
  }
  protected override AsyncCb(
    invokeStack: F.FuncInvokeStack<I, O, D, "AsyncCb">,
    context: F.Context<F.Func<I, O, D, "AsyncCb">>,
    input: z.core.output<I>,
  ): F.AsyncCbReceiver<z.core.output<O>> {
    const cache = this._getCacheController(context, input);
    return this._getData(context, cache).pipe(() => {
      if (!this._shouldInvoke(cache)) {
        return F.AsyncCbReceiver.value(this._convertCache(cache));
      }
      input = this._updatedInput(context, cache);
      return invokeStack.$(context, input).pipeThen((output) => {
        this._setData(context, cache, output);
        return this._convertCache(cache);
      });
    });
  }
}
export function VoidFn() {}
