export abstract class ZodType<T> {
  readonly _type!: T;

  abstract parse(data: unknown): T;

  describe(): string {
    return 'unknown';
  }

  optional(): ZodOptional<this> {
    return new ZodOptional(this);
  }
}

export type ZodTypeAny = ZodType<unknown>;

class ZodString extends ZodType<string> {
  parse(data: unknown): string {
    if (typeof data !== 'string') {
      throw new Error('Expected string');
    }
    return data;
  }

  describe(): string {
    return 'string';
  }
}

class ZodNumber extends ZodType<number> {
  parse(data: unknown): number {
    if (typeof data !== 'number') {
      throw new Error('Expected number');
    }
    return data;
  }

  describe(): string {
    return 'number';
  }
}

class ZodObject<Shape extends Record<string, ZodTypeAny>> extends ZodType<{ [K in keyof Shape]: Shape[K]['_type'] }> {
  constructor(private readonly shape: Shape) {
    super();
  }

  parse(data: unknown) {
    if (typeof data !== 'object' || data === null) {
      throw new Error('Expected object');
    }
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(this.shape) as Array<keyof Shape>) {
      const schema = this.shape[key];
      const value = (data as Record<string, unknown>)[key as string];
      result[key as string] = schema.parse(value);
    }
    return result as { [K in keyof Shape]: Shape[K]['_type'] };
  }

  describe(): string {
    const entries = Object.entries(this.shape).map(([key, schema]) => `  ${key}: ${schema.describe()}`);
    return `object\n${entries.join('\n')}`;
  }

  getShape(): Shape {
    return this.shape;
  }
}

class ZodArray<Inner extends ZodTypeAny> extends ZodType<Array<Inner['_type']>> {
  private minLength: number | null = null;
  private maxLength: number | null = null;

  constructor(private readonly inner: Inner) {
    super();
  }

  parse(data: unknown) {
    let working: unknown[];

    if (Array.isArray(data)) {
      working = data;
    } else if (data && typeof data === 'object') {
      working = Object.values(data as Record<string, unknown>);
    } else if (data === undefined || data === null) {
      throw new Error('Expected array');
    } else {
      working = [data];
    }

    if (this.minLength !== null && working.length < this.minLength) {
      throw new Error(`Expected array length >= ${this.minLength}`);
    }
    if (this.maxLength !== null && working.length > this.maxLength) {
      throw new Error(`Expected array length <= ${this.maxLength}`);
    }
    return working.map((item) => this.inner.parse(item));
  }

  describe(): string {
    return `array<${this.inner.describe()}>`;
  }

  getInner(): Inner {
    return this.inner;
  }

  min(value: number): this {
    this.minLength = value;
    return this;
  }

  max(value: number): this {
    this.maxLength = value;
    return this;
  }
}

class ZodOptional<Inner extends ZodTypeAny> extends ZodType<Inner['_type'] | undefined> {
  constructor(private readonly inner: Inner) {
    super();
  }

  parse(data: unknown): Inner['_type'] | undefined {
    if (data === undefined || data === null) {
      return undefined;
    }
    return this.inner.parse(data);
  }

  describe(): string {
    return `${this.inner.describe()}?`;
  }
}

export const z = {
  string: () => new ZodString(),
  number: () => new ZodNumber(),
  object: <Shape extends Record<string, ZodTypeAny>>(shape: Shape) => new ZodObject(shape),
  array: <Inner extends ZodTypeAny>(inner: Inner) => new ZodArray(inner),
} as const;

export type infer<T extends ZodTypeAny> = T['_type'];

export namespace z {
  export type infer<T extends ZodTypeAny> = T['_type'];
}
