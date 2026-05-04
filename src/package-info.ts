import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

interface PackageJson {
  readonly version?: unknown;
}

export function readPackageVersion(): string {
  const packageJson = require("../package.json") as PackageJson;

  if (typeof packageJson.version === "string" && packageJson.version.length > 0) {
    return packageJson.version;
  }

  throw new Error("package.json 缺少有效 version 字段");
}
