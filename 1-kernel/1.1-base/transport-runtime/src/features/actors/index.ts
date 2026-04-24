export * from './serverSpaceActor'

import type {ActorDefinition} from '@next/kernel-base-runtime-shell-v2'
import type {TransportServerConfig} from '../../types'
import {createTransportServerSpaceActor} from './serverSpaceActor'

export const createTransportRuntimeActorDefinitions = (
    config: TransportServerConfig,
): readonly ActorDefinition[] => [
    createTransportServerSpaceActor(config),
]
