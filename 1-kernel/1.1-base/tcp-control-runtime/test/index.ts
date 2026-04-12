import {packageVersion} from '../src'

console.log('[tcp-control-runtime-test-scenario]', {
  packageName: '@impos2/kernel-base-tcp-control-runtime',
  packageVersion,
  message: 'Vitest scenarios cover runtime execution and persistence. Real mock-terminal-platform integration is reserved for the next TDP-dependent phase.',
})
