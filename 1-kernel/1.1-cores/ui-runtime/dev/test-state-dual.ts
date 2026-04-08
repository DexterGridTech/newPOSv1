import fs from 'node:fs/promises'
import path from 'node:path'
import {spawn, type ChildProcess} from 'node:child_process'
import {assert, resolveDevFile, TSX_CLI} from './shared'

function wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function spawnLoggedProcess(label: string, command: string, args: string[], cwd: string) {
    const child = spawn(command, args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
            ...process.env,
            FORCE_COLOR: '0',
        },
    })

    child.stdout.on('data', chunk => {
        process.stdout.write(`[${label}] ${chunk}`)
    })
    child.stderr.on('data', chunk => {
        process.stderr.write(`[${label}] ${chunk}`)
    })

    return child
}

async function waitForFile(filePath: string, timeoutMs = 20_000) {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
        try {
            await fs.access(filePath)
            return
        } catch {
            await wait(100)
        }
    }
    throw new Error(`timeout waiting for file: ${filePath}`)
}

async function waitForServerHealth(timeoutMs = 10_000) {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
        try {
            const response = await fetch('http://127.0.0.1:8888/mockMasterServer/health')
            if (response.ok) {
                return
            }
        } catch {
        }
        await wait(100)
    }
    throw new Error('master-ws-server-dual health check timeout')
}

async function killProcess(child: ChildProcess | undefined) {
    if (!child || child.exitCode != null) return
    child.kill('SIGTERM')
    await wait(200)
    if (child.exitCode == null) {
        child.kill('SIGKILL')
    }
}

async function main() {
    const rootDir = process.cwd()
    const tmpDir = path.join(rootDir, 'ai-result', 'dev-storage', 'ui-runtime-dual')
    const masterConfigFile = path.join(tmpDir, 'master.config.json')
    const slaveConfigFile = path.join(tmpDir, 'slave.config.json')
    const masterResultFile = path.join(tmpDir, 'master.result.json')
    const slaveResultFile = path.join(tmpDir, 'slave.result.json')

    await fs.rm(tmpDir, {recursive: true, force: true})
    await fs.mkdir(tmpDir, {recursive: true})

    await fs.writeFile(masterConfigFile, JSON.stringify({
        role: 'master',
        resultFile: masterResultFile,
    }, null, 2))

    await fs.writeFile(slaveConfigFile, JSON.stringify({
        role: 'slave',
        resultFile: slaveResultFile,
    }, null, 2))

    let serverProcess: ChildProcess | undefined
    let masterProcess: ChildProcess | undefined
    let slaveProcess: ChildProcess | undefined

    try {
        serverProcess = spawnLoggedProcess(
            'master-ws-server',
            'node',
            [TSX_CLI, '0-mock-server/master-ws-server-dual/src/index.ts'],
            rootDir,
        )
        await waitForServerHealth()

        masterProcess = spawnLoggedProcess(
            'ui-runtime-master',
            'node',
            [TSX_CLI, resolveDevFile('worker.ts'), masterConfigFile],
            rootDir,
        )
        await wait(300)

        slaveProcess = spawnLoggedProcess(
            'ui-runtime-slave',
            'node',
            [TSX_CLI, resolveDevFile('worker.ts'), slaveConfigFile],
            rootDir,
        )

        await Promise.all([
            waitForFile(masterResultFile),
            waitForFile(slaveResultFile),
        ])

        const masterResult = JSON.parse(await fs.readFile(masterResultFile, 'utf-8'))
        const slaveResult = JSON.parse(await fs.readFile(slaveResultFile, 'utf-8'))

        assert(!masterResult.error, `master worker failed: ${masterResult.error}`)
        assert(!slaveResult.error, `slave worker failed: ${slaveResult.error}`)

        assert(masterResult.serverConnectionStatus === 'CONNECTED', 'master should connect to dual ws server')
        assert(slaveResult.serverConnectionStatus === 'CONNECTED', 'slave should connect to dual ws server')
        assert(masterResult.slaveConnected === true, 'master should observe slave connected')
        assert(masterResult.currentScreen?.partKey === 'dev.primary.root', 'master current screen should be written')
        assert(masterResult.orderNo === 'A1001', 'master ui variable should be written')
        assert(slaveResult.syncedOrderNo === 'A1001', 'slave should receive synced ui variable')
        assert(slaveResult.syncedAmount === 128, 'slave should receive synced numeric ui variable')
        assert(slaveResult.syncedScreen?.partKey === 'dev.primary.root', 'slave should receive synced screen state')
        assert(slaveResult.displayMode === 'secondary', 'slave process should run in secondary display mode')
        assert(slaveResult.workspace === 'main', 'slave secondary display should remain in main workspace')

        console.log('[ui-runtime/dev][dual] master connected:', masterResult.serverConnectionStatus)
        console.log('[ui-runtime/dev][dual] slave connected:', slaveResult.serverConnectionStatus)
        console.log('[ui-runtime/dev][dual] synced orderNo:', slaveResult.syncedOrderNo)
        console.log('[ui-runtime/dev][dual] synced screen partKey:', slaveResult.syncedScreen?.partKey)
    } finally {
        await killProcess(slaveProcess)
        await killProcess(masterProcess)
        await killProcess(serverProcess)
    }
}

main().catch(error => {
    console.error('[ui-runtime/dev][dual] failed:', error)
    process.exitCode = 1
})
