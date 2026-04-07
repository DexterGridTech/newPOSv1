import type {TypeDescriptor} from '../../types'

export function typed<T>(name?: string): TypeDescriptor<T> {
  return {
    kind: 'type-descriptor',
    name,
  }
}
