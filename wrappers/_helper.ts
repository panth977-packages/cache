import { F } from "@panth977/functions";
import type { z } from "zod";

export abstract class WFGenericCache<
  C,
  I extends F.FuncInput,
  O extends F.FuncOutput,
> extends F.GenericFuncWrapper<I, O, "AsyncFunc"> {
  private Hook?: (hook: this) => void;
  private _func?: F.Func<I, O, "AsyncFunc">;
  constructor({
    onInit,
  }: {
    onInit?: (hook: WFGenericCache<C, I, O>) => void;
  }) {
    super();
    this.Hook = onInit;
  }
  protected get func(): F.Func<I, O, "AsyncFunc"> {
    if (!this._func) throw new Error("Function not initialized");
    return this._func;
  }
  override optimize(func: F.Func<I, O, "AsyncFunc">): void {
    this._func = func;
    super.optimize(func);
    this.Hook?.(this);
    delete this.Hook;
  }
  protected override SyncFunc: undefined;
  protected override StreamFunc: undefined;
  protected abstract _getCacheApi(
    context: F.Context<F.Func<I, O, "AsyncFunc">>,
    input: z.infer<I>,
  ): C;
  protected abstract _getData(
    context: F.Context<F.Func<I, O, "AsyncFunc">>,
    cache: C,
  ): Promise<void>;
  protected abstract _shouldInvoke(cache: C): boolean;
  protected abstract _updatedInput(
    context: F.Context<F.Func<I, O, "AsyncFunc">>,
    cache: C,
  ): z.infer<I>;
  protected abstract _setData(
    context: F.Context<F.Func<I, O, "AsyncFunc">>,
    cache: C,
    output: z.infer<O>,
  ): Promise<void>;
  protected abstract _delCache(
    context: F.Context<F.Func<I, O, "AsyncFunc">>,
    cache: C,
  ): Promise<void>;
  protected abstract _convertCache(cache: C): z.infer<O>;
  get(context: F.Context, input: z.infer<I>): Promise<z.infer<O>> {
    const cache = this._getCacheApi(context, input);
    return this._getData(context, cache).then(() => this._convertCache(cache));
  }
  set(
    context: F.Context,
    input: z.infer<I>,
    output: z.infer<O>,
  ): Promise<void> {
    const cache = this._getCacheApi(context, input);
    return this._setData(context, cache, output);
  }
  del(context: F.Context, input: z.infer<I>): Promise<void> {
    const cache = this._getCacheApi(context, input);
    return this._delCache(context, cache);
  }
  protected override AsyncFunc(
    invokeStack: F.FuncInvokeStack<I, O, "AsyncFunc">,
    context: F.Context<F.Func<I, O, "AsyncFunc">>,
    input: z.infer<I>,
  ): Promise<z.infer<O>> {
    const cache = this._getCacheApi(context, input);
    return this._getData(context, cache).then(() => {
      if (!this._shouldInvoke(cache)) {
        return Promise.resolve(this._convertCache(cache));
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
