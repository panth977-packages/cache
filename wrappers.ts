import type { FUNCTIONS } from "@panth977/functions";
import type { z } from "zod";
import type { Hook } from "./hooks/_helper.ts";

/**
 * A simple wrapper, to create a cache layer.
 * @param _params 
 * @param behavior 
 * @returns 
 */
export function Wrapper<
  I extends z.ZodType,
  O extends z.ZodType,
  S,
  C extends FUNCTIONS.Context,
  H extends Hook<any, O>
>(
  _params: FUNCTIONS.AsyncFunction._Params<I, O, S, C>,
  {
    getHook,
    updateInput,
    useHook,
  }: {
    getHook(context: C, input: z.infer<I>): H;
    updateInput(
      context: C,
      input: z.infer<I>,
      info: H extends Hook<infer Info, O> ? Info : unknown
    ): z.infer<I>;
    useHook?(hook: (context: C, input: z.infer<I>) => H): void;
  }
): FUNCTIONS.AsyncFunction.WrapperBuild<I, O, S, C> & {
  getHook: typeof getHook;
} {
  useHook?.(getHook);
  const Wrapper: FUNCTIONS.AsyncFunction.WrapperBuild<I, O, S, C> =
    async function (context, input, func) {
      const hook = getHook(context, input);
      const result = await hook.get();
      if (hook.isIncomplete(result.info)) {
        input = updateInput(context, input, result.info);
        const res_ = func(context, input);
        hook.set(res_);
        result.val = hook.merge(result.val, await res_);
      }
      return result.val;
    };
  return Object.assign(Wrapper, { getHook });
}
