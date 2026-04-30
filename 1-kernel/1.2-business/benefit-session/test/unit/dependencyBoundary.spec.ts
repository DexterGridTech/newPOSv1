import {readdirSync, readFileSync, statSync} from 'node:fs'
import {join, relative} from 'node:path'
import {describe, expect, it} from 'vitest'

const forbiddenImportFragments = [
    'catering-',
    'retail',
    'cosmetic',
    'mock-terminal-platform',
    'mock-admin',
]

const forbiddenSourcePatterns = [
    {
        pattern: /new URLSearchParams\(/,
        reason: 'manual query-string construction bypasses transport-runtime endpoint URL building',
    },
    {
        pattern: /baseUrl\s*\+/,
        reason: 'manual baseUrl concatenation bypasses transport-runtime server catalog and failover',
    },
    {
        pattern: /response\.text\(\)/,
        reason: 'manual HTTP envelope parsing belongs in transport-runtime service binding',
    },
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

describe('benefit session dependency boundary', () => {
    it('does not import concrete cart/order business packages or mock servers', () => {
        const srcRoot = join(__dirname, '../../src')
        const violations = collectSourceFiles(srcRoot).flatMap((file) => {
            const content = readFileSync(file, 'utf8')
            return forbiddenImportFragments
                .filter((fragment) => content.includes(`from '${fragment}`) || content.includes(`from "${fragment}`))
                .map((fragment) => `${relative(srcRoot, file)} imports ${fragment}`)
        })

        expect(violations).toEqual([])
    })

    it('does not hand-roll HTTP URL construction or envelope parsing', () => {
        const srcRoot = join(__dirname, '../../src')
        const violations = collectSourceFiles(srcRoot).flatMap((file) => {
            const content = readFileSync(file, 'utf8')
            return forbiddenSourcePatterns
                .filter(({pattern}) => pattern.test(content))
                .map(({reason}) => `${relative(srcRoot, file)} ${reason}`)
        })

        expect(violations).toEqual([])
    })
})
