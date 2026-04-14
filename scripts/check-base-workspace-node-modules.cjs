#!/usr/bin/env node

const {readdirSync, statSync} = require('node:fs')
const {join} = require('node:path')

const baseRoot = join(process.cwd(), '1-kernel', '1.1-base')

const findWorkspaceNodeModules = () => {
    const offenders = []

    for (const entry of readdirSync(baseRoot, {withFileTypes: true})) {
        if (!entry.isDirectory()) {
            continue
        }

        const candidate = join(baseRoot, entry.name, 'node_modules')
        try {
            if (statSync(candidate).isDirectory()) {
                offenders.push(candidate)
            }
        } catch {
            // ignore missing path
        }
    }

    return offenders
}

const offenders = findWorkspaceNodeModules()

if (offenders.length === 0) {
    console.log('OK: no package-local node_modules directories found under 1-kernel/1.1-base')
    process.exit(0)
}

console.error('Found forbidden package-local node_modules directories under 1-kernel/1.1-base:')
for (const offender of offenders) {
    console.error(`- ${offender}`)
}
process.exit(1)
