import { Writable } from "node:stream";

export class PromptOutput extends Writable {
  readonly columns: number;
  readonly rows: number;
  readonly isTTY: boolean;

  constructor(private readonly target: Writable) {
    super();
    const output = target as Writable & {
      readonly columns?: number;
      readonly rows?: number;
      readonly isTTY?: boolean;
    };
    this.columns = output.columns ?? 80;
    this.rows = output.rows ?? 24;
    this.isTTY = output.isTTY ?? true;
  }

  override _write(
    chunk: string | Buffer,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.target.write(chunk, encoding, callback);
  }
}

export function createPromptOutput(stdout: Writable): Writable {
  return new PromptOutput(stdout);
}
