// Shared by the build and renderer tests; independent of Node's experimental TS API.
const ts = require('typescript');
function transpile(source, fileName) {
  const result = ts.transpileModule(source, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      isolatedModules: true,
      verbatimModuleSyntax: true
    }
  });
  const errors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  if (errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, {
    getCanonicalFileName: f => f,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => '\n'
  }));
  return result.outputText;
}
module.exports = { transpile };
