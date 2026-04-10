import type {CreatePlatformPortsInput, PlatformPorts} from '../types/ports'

export const createPlatformPorts = (
    input: CreatePlatformPortsInput,
): PlatformPorts => {
    return Object.freeze({
        ...input,
    })
}
