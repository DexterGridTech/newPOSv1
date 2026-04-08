import {SocketParseError} from '../../types'
import type {SocketCodec} from '../../types'

export class JsonSocketCodec<TIncoming = unknown, TOutgoing = unknown> implements SocketCodec<TIncoming, TOutgoing> {
  serialize(message: TOutgoing): string {
    return JSON.stringify(message)
  }

  deserialize(raw: string): TIncoming {
    try {
      return JSON.parse(raw) as TIncoming
    } catch (error) {
      throw new SocketParseError('Socket 消息 JSON 解析失败', {raw, error})
    }
  }
}
