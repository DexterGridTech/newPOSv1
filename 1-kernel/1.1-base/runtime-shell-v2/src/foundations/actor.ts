import type {
    ActorCommandHandler,
    ActorCommandHandlerDefinitionFor,
    CommandDefinition,
} from '../types'

export const onCommand = <TCommand extends CommandDefinition<any>>(
    commandDefinition: TCommand,
    handle: ActorCommandHandler<
        TCommand extends CommandDefinition<infer TPayload>
            ? TPayload
            : never
    >,
): ActorCommandHandlerDefinitionFor<TCommand> => ({
    commandName: commandDefinition.commandName,
    handle,
})
