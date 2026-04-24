import {describe, expect, it} from 'vitest'
import {createAppError} from '@next/kernel-base-contracts'
import {
    createDefinitionRegistryBundle,
    createDefinitionResolverBundle,
    createKeyedDefinitionRegistry,
    resolveAppError,
    resolveErrorDefinitionByKey,
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
                return typeof value === 'number' && value > 0
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

    it('resolves json parameters from strings or objects and falls back on invalid json', () => {
        const registries = createDefinitionRegistryBundle()
        const definition = registries.parameters.register({
            key: 'kernel.base.definition-registry.parameter.layout',
            name: 'Layout',
            defaultValue: {theme: 'default'},
            valueType: 'json',
            moduleName: 'kernel.base.definition-registry.test',
        })

        const fromString = resolveParameter({
            definition,
            parameterCatalog: {
                [definition.key]: {
                    key: definition.key,
                    rawValue: JSON.stringify({theme: 'remote'}),
                    updatedAt: 1 as any,
                    source: 'remote',
                },
            },
        })
        const fromObject = resolveParameter({
            definition,
            parameterCatalog: {
                [definition.key]: {
                    key: definition.key,
                    rawValue: {theme: 'object'},
                    updatedAt: 2 as any,
                    source: 'remote',
                },
            },
        })
        const fallback = resolveParameter({
            definition,
            parameterCatalog: {
                [definition.key]: {
                    key: definition.key,
                    rawValue: '{invalid-json',
                    updatedAt: 3 as any,
                    source: 'remote',
                },
            },
        })

        expect(fromString).toMatchObject({
            value: {theme: 'remote'},
            source: 'catalog',
            valid: true,
        })
        expect(fromObject).toMatchObject({
            value: {theme: 'object'},
            source: 'catalog',
            valid: true,
        })
        expect(fallback).toMatchObject({
            value: {theme: 'default'},
            source: 'catalog-fallback',
            valid: false,
        })
    })

    it('decodes boolean parameters with explicit true/false semantics', () => {
        const registries = createDefinitionRegistryBundle()
        const definition = registries.parameters.register({
            key: 'kernel.base.definition-registry.parameter.feature-enabled',
            name: 'Feature Enabled',
            defaultValue: false,
            valueType: 'boolean',
            moduleName: 'kernel.base.definition-registry.test',
        })

        const trueFromCatalog = resolveParameter({
            definition,
            parameterCatalog: {
                [definition.key]: {
                    key: definition.key,
                    rawValue: 'true',
                    updatedAt: 1 as any,
                    source: 'remote',
                },
            },
        })
        expect(trueFromCatalog.value).toBe(true)
        expect(trueFromCatalog.valid).toBe(true)
        expect(trueFromCatalog.source).toBe('catalog')

        const falseFromCatalog = resolveParameter({
            definition,
            parameterCatalog: {
                [definition.key]: {
                    key: definition.key,
                    rawValue: 'false',
                    updatedAt: 2 as any,
                    source: 'remote',
                },
            },
        })
        expect(falseFromCatalog.value).toBe(false)
        expect(falseFromCatalog.valid).toBe(true)
        expect(falseFromCatalog.source).toBe('catalog')

        const falseFromNumber = resolveParameter({
            definition,
            parameterCatalog: {
                [definition.key]: {
                    key: definition.key,
                    rawValue: 0,
                    updatedAt: 3 as any,
                    source: 'remote',
                },
            },
        })
        expect(falseFromNumber.value).toBe(false)
        expect(falseFromNumber.valid).toBe(true)

        const fallback = resolveParameter({
            definition,
            parameterCatalog: {
                [definition.key]: {
                    key: definition.key,
                    rawValue: 'invalid',
                    updatedAt: 4 as any,
                    source: 'remote',
                },
            },
        })
        expect(fallback.value).toBe(false)
        expect(fallback.valid).toBe(false)
        expect(fallback.source).toBe('catalog-fallback')
    })

    it('returns definition defaults when no parameter catalog entry exists', () => {
        const registries = createDefinitionRegistryBundle()
        const definition = registries.parameters.register({
            key: 'kernel.base.definition-registry.parameter.default-only',
            name: 'Default Only',
            defaultValue: 7,
            valueType: 'number',
            moduleName: 'kernel.base.definition-registry.test',
        })

        expect(resolveParameter({definition})).toEqual({
            key: definition.key,
            value: 7,
            source: 'default',
            valid: true,
        })
    })

    it('falls back on invalid numeric raw value and rejects mismatched appError key', () => {
        const registries = createDefinitionRegistryBundle()
        const definition = registries.parameters.register({
            key: 'kernel.base.definition-registry.parameter.invalid-number',
            name: 'Invalid Number',
            defaultValue: 10,
            valueType: 'number',
            moduleName: 'kernel.base.definition-registry.test',
        })
        const errorDefinition = registries.errors.register({
            key: 'kernel.base.definition-registry.error.a',
            name: 'Error A',
            defaultTemplate: 'error a',
            category: 'SYSTEM',
            severity: 'LOW',
            moduleName: 'kernel.base.definition-registry.test',
        })
        registries.errors.register({
            key: 'kernel.base.definition-registry.error.b',
            name: 'Error B',
            defaultTemplate: 'error b',
            category: 'SYSTEM',
            severity: 'LOW',
            moduleName: 'kernel.base.definition-registry.test',
        })

        const invalidNumber = resolveParameter({
            definition,
            parameterCatalog: {
                [definition.key]: {
                    key: definition.key,
                    rawValue: 'not-a-number',
                    updatedAt: 1 as any,
                    source: 'remote',
                },
            },
        })

        expect(invalidNumber.value).toBe(10)
        expect(invalidNumber.valid).toBe(false)

        const appError = createAppError(errorDefinition)
        expect(() => resolveErrorDefinitionByKey({
            key: 'kernel.base.definition-registry.error.b',
            errorRegistry: registries.errors,
            appError,
        })).toThrow(/appError.key mismatch/)
    })

    it('resolves error definitions from catalog overrides without requiring an app error', () => {
        const registries = createDefinitionRegistryBundle()
        const definition = registries.errors.register({
            key: 'kernel.base.definition-registry.error.catalog-only',
            name: 'Catalog Error',
            defaultTemplate: 'default template',
            category: 'SYSTEM',
            severity: 'LOW',
            moduleName: 'kernel.base.definition-registry.test',
        })

        expect(resolveErrorDefinitionByKey({
            key: definition.key,
            errorRegistry: registries.errors,
            errorCatalog: {
                [definition.key]: {
                    key: definition.key,
                    template: 'catalog template',
                    updatedAt: 1 as any,
                    source: 'remote',
                },
            },
        })).toMatchObject({
            key: definition.key,
            message: 'catalog template',
            source: 'catalog',
        })
    })

    it('uses custom decode functions and resolver bundles by key', () => {
        const registries = createDefinitionRegistryBundle()
        const definition = registries.parameters.register({
            key: 'kernel.base.definition-registry.parameter.custom',
            name: 'Custom',
            defaultValue: 'seed',
            valueType: 'string',
            decode(rawValue) {
                return `decoded:${String(rawValue)}`
            },
            moduleName: 'kernel.base.definition-registry.test',
        })
        const resolver = createDefinitionResolverBundle(registries, {
            parameterCatalog: {
                [definition.key]: {
                    key: definition.key,
                    rawValue: 'remote',
                    updatedAt: 1 as any,
                    source: 'remote',
                },
            },
        })

        expect(resolver.resolveParameterByKey<string>(definition.key)).toEqual({
            key: definition.key,
            value: 'decoded:remote',
            source: 'catalog',
            valid: true,
        })
        expect(() => resolver.resolveParameterByKey('kernel.base.definition-registry.parameter.missing')).toThrow(
            /definition not found/,
        )
    })

    it('rejects duplicate registry keys and exposes list plus frozen snapshot views', () => {
        const registry = createKeyedDefinitionRegistry<{
            key: string
            name: string
        }>('test-definition')
        const definition = {
            key: 'kernel.base.definition-registry.definition.duplicated',
            name: 'Duplicated',
        }

        registry.register(definition)

        expect(() => registry.register(definition)).toThrow(/duplicated definition key/)
        expect(registry.list()).toEqual([definition])
        expect(registry.snapshot()).toEqual({
            [definition.key]: definition,
        })
        expect(Object.isFrozen(registry.snapshot())).toBe(true)
    })
})
