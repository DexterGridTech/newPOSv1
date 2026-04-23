#!/usr/bin/env node

const {readdirSync, statSync} = require('node:fs')
const {join} = require('node:path')

const packageRoots = [
    {
        label: '1-kernel/1.1-base',
        root: join(process.cwd(), '1-kernel', '1.1-base'),
        forbiddenDirs: ['node_modules', '.tmp'],
    },
    {
        label: '2-ui/2.1-base',
        root: join(process.cwd(), '2-ui', '2.1-base'),
        forbiddenDirs: ['node_modules', '.tmp'],
    },
    {
        label: '2-ui/2.3-integration',
        root: join(process.cwd(), '2-ui', '2.3-integration'),
        forbiddenDirs: ['node_modules', '.tmp'],
    },
    {
        label: '3-adapter/android',
        root: join(process.cwd(), '3-adapter', 'android'),
        forbiddenDirs: ['node_modules', '.tmp'],
    },
    {
        label: '4-assembly/android',
        root: join(process.cwd(), '4-assembly', 'android'),
        forbiddenDirs: ['.tmp'],
    },
]

const findForbiddenDirs = ({root, forbiddenDirs}) => {
    const offenders = []

    for (const entry of readdirSync(root, {withFileTypes: true})) {
        if (!entry.isDirectory()) {
            continue
        }

        for (const dirName of forbiddenDirs) {
            const candidate = join(root, entry.name, dirName)
            try {
                if (statSync(candidate).isDirectory()) {
                    offenders.push(candidate)
                }
            } catch {
                // ignore missing path
            }
        }
    }

    return offenders
}

const offenders = packageRoots.flatMap(config => findForbiddenDirs(config))

if (offenders.length === 0) {
    console.log('OK: no package-local node_modules or .tmp directories found in scoped workspaces')
    process.exit(0)
}

console.error('Found forbidden package-local directories:')
for (const offender of offenders) {
    console.error(`- ${offender}`)
}
process.exit(1)
