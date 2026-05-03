export interface CapabilitiesTemplateOptions {
  readonly updatedAt: string;
}

export function createCapabilitiesTemplate(options: CapabilitiesTemplateOptions): string {
  return `---
schema: louisgo-capabilities-v1
updated_at: "${options.updatedAt}"
---

# Capabilities

## Verify

- macOS / Linux: \`.louisgo/scripts/verify.sh\`
- Windows: \`.louisgo/scripts/verify.ps1\`
- Result: \`.louisgo/test-results.json\`

## Context

- Start/recover: \`louisgo context\`
- Pending decision UI: \`louisgo confirm\`
- Finish: \`louisgo finish\`
- Pending decision: \`.louisgo/CONFIRM_REQ.md\`
`;
}
