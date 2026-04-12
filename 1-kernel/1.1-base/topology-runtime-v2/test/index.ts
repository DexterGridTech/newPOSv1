import {execFileSync} from 'node:child_process'

execFileSync('vitest', ['run'], {
    stdio: 'inherit',
})
