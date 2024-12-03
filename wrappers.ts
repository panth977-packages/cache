import type { z } from "zod";
import type { Hook } from "./hooks/_helper.ts";
import type { FUNCTIONS } from "@panth977/functions";

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
>({
  getHook,
  updateInput,
  useHook,
}: {
  _params: FUNCTIONS.AsyncFunction._Params<I, O, S, C>;
  getHook(arg: { context: C; input: z.infer<I> }): H;
  updateInput?(arg: {
    context: C;
    input: z.infer<I>;
    info: H extends Hook<infer Info, O> ? Info : unknown;
  }): z.infer<I>;
  useHook?(hook: (arg: { context: C; input: z.infer<I> }) => H): void;
}): FUNCTIONS.AsyncFunction.WrapperBuild<I, O, S, C> & {
  getHook(arg: { context: C; input: z.infer<I> }): H;
  stateKey: { key: symbol; _type: Awaited<ReturnType<H["get"]>> };
} {
  const stateKey = {
    key: Symbol(),
    _type: {} as Awaited<ReturnType<H["get"]>>,
  };
  useHook?.(getHook);
  const Wrapper: FUNCTIONS.AsyncFunction.WrapperBuild<I, O, S, C> =
    async function ({ context, input, func, build }) {
      const hook = getHook({ context, input });
      const result = await hook.get({ safe: true });
      context.setState({ key: stateKey.key, val: result });
      if (hook.isIncomplete({ info: result.info })) {
        input = updateInput?.({ context, input, info: result.info }) ?? input;
        const res_ = func({ context, input, build });
        hook.set({ output: res_ });
        result.val = hook.merge({ target: result.val, extension: await res_ });
      }
      return result.val;
    };
  return Object.assign(Wrapper, { getHook, stateKey });
}
