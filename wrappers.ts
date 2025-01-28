import type { z } from "zod";
import { Hook } from "./hooks/_helper.ts";
import { FUNCTIONS } from "@panth977/functions";

/**
 * A simple wrapper, to create a cache layer.
 * @param _params
 * @param behavior
 * @returns
 */
export function Wrapper<
  I extends z.ZodType,
  O extends z.ZodType,
  S extends Record<never, never>,
  C extends FUNCTIONS.Context,
  Info
>({
  _params,
  getHook: getHook_,
  updateInput,
  useHook,
}: {
  _params: FUNCTIONS.AsyncFunction._Params<I, O, S, C>;
  getHook(arg: { context?: C; input: z.infer<I> }): null | Hook<Info, O>;
  updateInput?(arg: { context: C; input: z.infer<I>; info: Info }): z.infer<I>;
  useHook?(
    hook: (arg: { context?: C; input: z.infer<I> }) => null | Hook<Info, O>
  ): void;
}): FUNCTIONS.AsyncFunction.WrapperBuild<I, O, S, C> & {
  getHook(arg: { context: C; input: z.infer<I> }): null | Hook<Info, O>;
  stateKey: FUNCTIONS.ContextStateKey<
    Awaited<ReturnType<Hook<Info, O>["get"]>>
  >;
} {
  const stateKey = FUNCTIONS.DefaultContextState.CreateKey<
    Awaited<ReturnType<Hook<Info, O>["get"]>>
  >({
    label: "CacheResult",
    scope: "local",
  });
  function getHook(arg: { context?: C; input: z.infer<I> }): null | Hook<Info, O> {
    const hook = getHook_(arg);
    if (!hook) return null;
    if (arg.context) Hook.updateContext(hook, arg.context);
    Hook.updateSchema(hook, _params.output);
    return hook;
  }
  useHook?.(getHook);
  const Wrapper: FUNCTIONS.AsyncFunction.WrapperBuild<I, O, S, C> =
    async function ({ context, input, func, build }) {
      const hook = getHook({ context, input });
      if (!hook) {
        return await func({ context, input, build });
      }
      const result = await hook.get({ safe: true });
      context.useState(stateKey).set(result as never);
      if (hook.isIncomplete(result)) {
        input = updateInput?.({ context, input, info: result.info }) ?? input;
        const res = await func({ context, input, build });
        result.val = hook.merge({ target: result.val, extension: res });
        hook.set({ output: result.val });
      }
      return result.val;
    };
  return Object.assign(Wrapper, { getHook, stateKey });
}

export function Wrap<I extends [] | [any, ...any[]], Info, O extends z.ZodType>(
  getHook: (...input: I) => Hook<Info, O>,
  func: (info: Info, ...input: I) => Promise<z.infer<O>>
): (...input: I) => Promise<z.infer<O>> {
  async function CacheFunc(...arg: I) {
    const hook = getHook(...arg);
    const result = await hook.get({ safe: !!hook.schema });
    if (hook.isIncomplete(result)) {
      const res = await func(result.info, ...arg);
      result.val = hook.merge({ target: result.val, extension: res });
      hook.set({ output: result.val });
    }
    return result.val;
  }
  return Object.assign(CacheFunc, getHook);
}
