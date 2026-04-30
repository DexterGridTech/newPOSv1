import {readdirSync, readFileSync, statSync} from 'node:fs'
import {join, relative} from 'node:path'
import {describe, expect, it} from 'vitest'

const forbiddenImportFragments = [
    '@reduxjs/toolkit',
    'react',
    'react-redux',
    'mock-terminal-platform',
    'catering-',
    'organization-iam-master-data',
]

function collectSourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name)
        const stat = statSync(path)
        if (stat.isDirectory()) {
            return collectSourceFiles(path)
        }
        return path.endsWith('.ts') ? [path] : []
    })
}

describe('calculation package dependency boundary', () => {
    it('keeps the pure calculation source free from runtime, UI, mock, and business package imports', () => {
        const srcRoot = join(__dirname, '../../src')
        const violations = collectSourceFiles(srcRoot).flatMap((file) => {
            const content = readFileSync(file, 'utf8')
            return forbiddenImportFragments
                .filter((fragment) => content.includes(`from '${fragment}`) || content.includes(`from "${fragment}`))
                .map((fragment) => `${relative(srcRoot, file)} imports ${fragment}`)
        })

        expect(violations).toEqual([])
    })
})
