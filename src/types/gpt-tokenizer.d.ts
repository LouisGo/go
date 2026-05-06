declare module "gpt-tokenizer/encoding/o200k_base" {
  export function encode(text: string): number[];
  export function decode(tokens: number[]): string;
  export function countTokens(text: string): number;
}
