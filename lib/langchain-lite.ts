/**
 * Minimal LangChain-inspired runnable primitives.
 *
 * We vendor these tiny helpers so the LangChain-style workflow can run
 * in constrained environments where installing the full @langchain/core
 * package is not possible.
 */
export interface Runnable<Input, Output> {
  invoke(input: Input): Promise<Output>;
}

export type RunnableFunction<Input, Output> = (input: Input) => Output | Promise<Output>;

export class RunnableLambda<Input, Output> implements Runnable<Input, Output> {
  private readonly func: RunnableFunction<Input, Output>;

  constructor(func: RunnableFunction<Input, Output>) {
    this.func = func;
  }

  async invoke(input: Input): Promise<Output> {
    return await this.func(input);
  }
}

export class RunnableSequence<Input, Output> implements Runnable<Input, Output> {
  private readonly steps: Runnable<any, any>[];

  constructor(steps: Runnable<any, any>[]) {
    this.steps = steps;
  }

  static from<First, Last>(steps: Runnable<any, any>[]): RunnableSequence<First, Last> {
    return new RunnableSequence<First, Last>(steps);
  }

  async invoke(input: Input): Promise<Output> {
    let current: unknown = input;
    for (const step of this.steps) {
      current = await step.invoke(current);
    }
    return current as Output;
  }
}

export class RunnablePassthrough<T> implements Runnable<T, T> {
  async invoke(input: T): Promise<T> {
    return input;
  }
}
