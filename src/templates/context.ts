export interface ContextTemplateOptions {
  readonly projectName?: string;
}

export function createContextTemplate(options: ContextTemplateOptions): string {
  const name = options.projectName?.trim() ?? "<Project Name>";

  return `# ${name} Domain Glossary

## Language

- **Term**: definition _Avoid_: alias1, alias2

## Relationships

- term A relates to term B because...

## Flagged Ambiguities

- term X is used inconsistently in the codebase: ...
`;
}
