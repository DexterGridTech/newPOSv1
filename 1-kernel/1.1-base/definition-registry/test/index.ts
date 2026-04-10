import {packageVersion, createDefinitionRegistryBundle} from '../src'

const registries = createDefinitionRegistryBundle()

registries.errors.register({
    key: 'kernel.base.definition-registry.test_error',
    name: 'Test Error',
    defaultTemplate: 'failed',
    category: 'SYSTEM',
    severity: 'LOW',
})

registries.parameters.register({
    key: 'kernel.base.definition-registry.test_parameter',
    name: 'Test Parameter',
    defaultValue: 30,
    valueType: 'number',
})

if (!registries.errors.has('kernel.base.definition-registry.test_error')) {
    throw new Error('Error definition registration failed')
}

if (!registries.parameters.has('kernel.base.definition-registry.test_parameter')) {
    throw new Error('Parameter definition registration failed')
}

let duplicateBlocked = false
try {
    registries.errors.register({
        key: 'kernel.base.definition-registry.test_error',
        name: 'Test Error',
        defaultTemplate: 'failed again',
        category: 'SYSTEM',
        severity: 'LOW',
    })
} catch (_error) {
    duplicateBlocked = true
}

if (!duplicateBlocked) {
    throw new Error('Duplicate definition keys must be rejected')
}

console.log('[definition-registry-test-scenario]', {
    packageName: '@impos2/kernel-base-definition-registry',
    packageVersion,
    errorDefinitions: registries.errors.list(),
    parameterDefinitions: registries.parameters.list(),
})
