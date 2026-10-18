// Node ESM 唔會自動補 ".ts"，亦要求 JSON import 寫明 `with { type: "json" }`。
// Bundler（Next / webpack / turbopack）兩樣都唔需要，所以 src 保持 extensionless import。
// 呢個 hook 只喺 `npm test` 用，令 `node --test` 可以直接跑未編譯嘅 TypeScript source，
// 唔使額外 devDependency，CI 亦唔使 npm install 就跑得。
import { registerHooks } from "node:module";

const HAS_EXTENSION = /\.[cm]?[jt]sx?$/;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".")) {
      if (specifier.endsWith(".json")) {
        return {
          ...nextResolve(specifier, context),
          importAttributes: { type: "json" },
        };
      }
      if (!HAS_EXTENSION.test(specifier)) {
        return nextResolve(`${specifier}.ts`, context);
      }
    }
    return nextResolve(specifier, context);
  },
});
