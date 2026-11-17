// Run in Node, outside Jest's React Compiler transform: TypeScript is tooling, not UI.
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const sourceRoot = path.resolve(__dirname, '../src')
const sources = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(directory, entry.name)
  if (entry.isDirectory())
    return entry.name === '__tests__' ? [] : sources(file)
  return /\.[jt]sx?$/.test(entry.name) ? [file] : []
})

function moduleReferences (file) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const references = []
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier))
      references.push(node.moduleSpecifier.text)
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      const specifier = node.arguments[0]
      if (specifier && ts.isStringLiteralLike(specifier))
        references.push(specifier.text)
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal))
      references.push(node.argument.literal.text)
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression))
      references.push(node.moduleReference.expression.text)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return references
}

const isBackendSDK = specifier => /^(?:@openim\/|open-im-sdk(?:-rn)?(?:\/|$))/.test(specifier)
const imports = sources(sourceRoot).flatMap(file => moduleReferences(file).filter(specifier => {
  if (isBackendSDK(specifier) || specifier.startsWith('@/'))
    return true
  if (!specifier.startsWith('.'))
    return false
  const relative = path.relative(sourceRoot, path.resolve(path.dirname(file), specifier))
  return relative === '..' || relative.startsWith(`..${path.sep}`)
}).map(specifier => `${path.relative(sourceRoot, file)} -> ${specifier}`))
const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, '..', 'package.json'), 'utf8'))
const dependencies = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies, ...manifest.optionalDependencies }).filter(isBackendSDK)
process.stdout.write(JSON.stringify({ imports, dependencies }))
if (imports.length || dependencies.length)
  process.exitCode = 1
