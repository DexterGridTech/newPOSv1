import {runSingleProcessAssertions} from './shared'

async function main() {
    const result = await runSingleProcessAssertions()
    console.log('[ui-runtime/dev][single] workspace:', result.workspace)
    console.log('[ui-runtime/dev][single] displayMode:', result.displayMode)
    console.log('[ui-runtime/dev][single] overlays before close:', result.overlayCountBeforeClose)
    console.log('[ui-runtime/dev][single] overlays after close:', result.overlayCountAfterClose)
    console.log('[ui-runtime/dev][single] keyword after clear:', result.keywordAfterClear)
}

main().catch(error => {
    console.error('[ui-runtime/dev][single] failed:', error)
    process.exitCode = 1
})
