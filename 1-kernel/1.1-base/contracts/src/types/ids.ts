export type TimestampMs = number

export type RuntimeInstanceId = string & {readonly __brand: 'RuntimeInstanceId'}
export type RequestId = string & {readonly __brand: 'RequestId'}
export type CommandId = string & {readonly __brand: 'CommandId'}
export type SessionId = string & {readonly __brand: 'SessionId'}
export type NodeId = string & {readonly __brand: 'NodeId'}
export type ConnectionId = string & {readonly __brand: 'ConnectionId'}
export type EnvelopeId = string & {readonly __brand: 'EnvelopeId'}
export type DispatchId = string & {readonly __brand: 'DispatchId'}
export type ProjectionId = string & {readonly __brand: 'ProjectionId'}

export type RuntimeIdKind =
    | 'runtime'
    | 'request'
    | 'command'
    | 'session'
    | 'node'
    | 'connection'
    | 'envelope'
    | 'dispatch'
    | 'projection'

export const INTERNAL_REQUEST_ID = 'INTERNAL' as RequestId
