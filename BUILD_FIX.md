# v0.2.2 patch for the modular v0.2.1 project

1. Close the running editor.
2. Extract this ZIP directly into your project folder (the folder containing package.json). Allow it to replace existing files. Keep the tests/ directory structure.
3. Run:

```
npm install
npm start
```

Node.js 22.12.0 is supported by the replacement build. The patch adds TypeScript 5.8.3 as a development dependency and removes use of node:module.stripTypeScriptTypes from the build and tests. Do not copy only build.cjs: it requires the included transpile.cjs and updated package.json.

Optional verification: npm test.

Verification in the development workspace: build succeeded and all 7 tests passed using Node 24.19.0 with TypeScript 5.8.3. The exact Node 22.12 executable was not available for verification. The code path no longer calls the missing Node API. Native Electron launch is not part of these tests.

Only build/test infrastructure and documentation are patched. Your editor modules, project JSON files and saved notes are unaffected. dist files are regenerated when npm start runs.
