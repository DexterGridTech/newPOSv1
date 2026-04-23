const fs = require('fs')
const path = require('path')

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.turbo') {
      continue
    }
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, results)
      continue
    }
    if (entry.isFile() && entry.name === 'package.json') {
      results.push(fullPath)
    }
  }
  return results
}

function main() {
  const roots = [
    path.join(process.cwd(), '1-kernel'),
    path.join(process.cwd(), '2-ui'),
  ]

  const packageJsonPaths = roots.flatMap(root => walk(root))
  for (const packageJsonPath of packageJsonPaths) {
    const packageDir = path.dirname(packageJsonPath)
    const srcDir = path.join(packageDir, 'src')
    const indexPath = path.join(srcDir, 'index.ts')
    if (!fs.existsSync(srcDir) || !fs.existsSync(indexPath)) {
      continue
    }

    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    const generatedDir = path.join(srcDir, 'generated')
    const generatedFile = path.join(generatedDir, 'packageVersion.ts')
    fs.mkdirSync(generatedDir, {recursive: true})
    fs.writeFileSync(generatedFile, `export const packageVersion = ${JSON.stringify(pkg.version)} as const\n`, 'utf8')
  }

  console.log('[release] generated package version info for kernel/ui packages')
}

main()
