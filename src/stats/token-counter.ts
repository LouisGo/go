import { countTokens, decode, encode } from "gpt-tokenizer/encoding/o200k_base";

export const tokenizerEncoding = "o200k_base";

export interface TokenTruncationResult {
  readonly text: string;
  readonly tokens: number;
  readonly truncated: boolean;
}

export interface CountSectionInput {
  readonly source: string;
  readonly title: string;
  readonly content: string;
}

export interface CountSectionResult {
  readonly source: string;
  readonly title: string;
  readonly tokens: number;
}

export function countTextTokens(text: string): number {
  if (text.length === 0) {
    return 0;
  }

  return countTokens(text);
}

export function truncateToTokens(text: string, maxTokens: number): TokenTruncationResult {
  const normalizedMax = Math.max(0, Math.floor(maxTokens));
  const tokens = encode(text);

  if (tokens.length <= normalizedMax) {
    return {
      text,
      tokens: tokens.length,
      truncated: false,
    };
  }

  if (normalizedMax === 0) {
    return {
      text: "",
      tokens: 0,
      truncated: true,
    };
  }

  const truncatedTokens = tokens.slice(0, normalizedMax);

  return {
    text: decode(truncatedTokens),
    tokens: truncatedTokens.length,
    truncated: true,
  };
}

export function countSections(
  sections: readonly CountSectionInput[],
): readonly CountSectionResult[] {
  return sections.map((section) => ({
    source: section.source,
    title: section.title,
    tokens: countTextTokens(section.content),
  }));
}
