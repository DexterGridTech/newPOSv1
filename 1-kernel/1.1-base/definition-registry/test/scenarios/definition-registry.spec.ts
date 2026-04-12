import {describe, expect, it} from 'vitest'
import {createAppError} from '@impos2/kernel-base-contracts'
import {
    createDefinitionRegistryBundle,
    createDefinitionResolverBundle,
    resolveAppError,
    resolveParameter,
} from '../../src'

describe('definition-registry resolvers', () => {
    it('resolves app errors through definition defaults and catalog overrides', () => {
        const registries = createDefinitionRegistryBundle()
        registries.errors.register({
            key: 'kernel.base.definition-registry.error.login_failed',
            name: 'Login Failed',
            defaultTemplate: 'login failed for ${userName}',
            category: 'BUSINESS',
            severity: 'LOW',
            moduleName: 'kernel.base.definition-registry.test',
        })

        const appError = createAppError(
            registries.errors.getOrThrow('kernel.base.definition-registry.error.login_failed'),
            {
                args: {
                    userName: 'boss',
                },
            },
        )

        const defaultResolved = resolveAppError({
            appError,
            definitionRegistry: registries.errors,
        })
        expect(defaultResolved.message).toBe('login failed for boss')
        expect(defaultResolved.source).toBe('definition-default')

        const resolver = createDefinitionResolverBundle(registries, {
            errorCatalog: {
                'kernel.base.definition-registry.error.login_failed': {
                    key: 'kernel.base.definition-registry.error.login_failed',
                    template: 'remote login failed',
                    updatedAt: 1 as any,
                    source: 'remote',
                },
            },
        })

        const catalogResolved = resolver.resolveAppError({appError})
        expect(catalogResolved.message).toBe('remote login failed')
        expect(catalogResolved.source).toBe('catalog')
    })

    it('resolves parameters from catalog and falls back on decode validation failure', () => {
        const registries = createDefinitionRegistryBundle()
        const definition = registries.parameters.register({
            key: 'kernel.base.definition-registry.parameter.timeout',
            name: 'Timeout',
            defaultValue: 3000,
            valueType: 'number',
            validate(value) {
                return value > 0
            },
            moduleName: 'kernel.base.definition-registry.test',
        })

        const fromCatalog = resolveParameter({
            definition,
            parameterCatalog: {
                'kernel.base.definition-registry.parameter.timeout': {
                    key: definition.key,
                    rawValue: '5000',
                    updatedAt: 1 as any,
                    source: 'remote',
                },
            },
        })
        expect(fromCatalog.value).toBe(5000)
        expect(fromCatalog.source).toBe('catalog')
        expect(fromCatalog.valid).toBe(true)

        const fallback = resolveParameter({
            definition,
            parameterCatalog: {
                'kernel.base.definition-registry.parameter.timeout': {
                    key: definition.key,
                    rawValue: '-1',
                    updatedAt: 2 as any,
                    source: 'remote',
                },
            },
        })
        expect(fallback.value).toBe(3000)
        expect(fallback.source).toBe('catalog-fallback')
        expect(fallback.valid).toBe(false)
    })
})
