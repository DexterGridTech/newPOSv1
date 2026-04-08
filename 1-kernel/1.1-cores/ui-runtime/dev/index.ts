import {spawn} from 'node:child_process'
import {resolveDevFile, TSX_CLI} from './shared'

interface TestResult {
    name: string
}

async function runTest(name: string, fileName: string): Promise<TestResult> {
    return new Promise((resolve, reject) => {
        const child = spawn('node', [TSX_CLI, resolveDevFile(fileName)], {
            cwd: process.cwd(),
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
                ...process.env,
                FORCE_COLOR: '0',
            },
        })

        child.stdout.on('data', chunk => {
            process.stdout.write(`[${name}] ${chunk}`)
        })
        child.stderr.on('data', chunk => {
            process.stderr.write(`[${name}] ${chunk}`)
        })

        child.on('exit', code => {
            if (code === 0) {
                resolve({name})
                return
            }
            reject(new Error(`${name} failed with exit code ${code}`))
        })
    })
}

async function main() {
    const results: TestResult[] = []
    results.push(await runTest('single', 'test-state-single.ts'))
    results.push(await runTest('dual', 'test-state-dual.ts'))

    results.forEach(result => {
        console.log(`[PASS] ${result.name}`)
    })
    console.log('All ui-runtime dev tests passed:', results.length)
}

main().catch(error => {
    console.error('[ui-runtime/dev] failed:', error)
    process.exitCode = 1
})
