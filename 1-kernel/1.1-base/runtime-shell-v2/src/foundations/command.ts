import type {CommandDefinition, CommandIntent, DefineCommandInput} from '../types'

export const defineCommand = <TPayload = unknown>(
    input: DefineCommandInput,
): CommandDefinition<TPayload> => ({
    moduleName: input.moduleName,
    commandName: input.commandName.includes('.')
        ? input.commandName
        : `${input.moduleName}.${input.commandName}`,
    visibility: input.visibility ?? 'public',
    timeoutMs: input.timeoutMs ?? 60_000,
    allowNoActor: input.allowNoActor ?? false,
    allowReentry: input.allowReentry ?? false,
    defaultTarget: input.defaultTarget ?? 'local',
})

export const createCommand = <TPayload>(
    definition: CommandDefinition<TPayload>,
    payload: TPayload,
): CommandIntent<TPayload> => ({
    definition,
    payload,
})
