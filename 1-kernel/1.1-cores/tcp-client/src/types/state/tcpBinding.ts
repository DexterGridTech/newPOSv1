import type {ValueWithUpdatedAt} from '@impos2/kernel-core-base'

// tcpBinding slice 把服务端下发的业务绑定上下文拆成可独立持久化的字段。
export interface TcpBindingState {
  platformId?: ValueWithUpdatedAt<string>
  tenantId?: ValueWithUpdatedAt<string>
  brandId?: ValueWithUpdatedAt<string>
  projectId?: ValueWithUpdatedAt<string>
  storeId?: ValueWithUpdatedAt<string>
  profileId?: ValueWithUpdatedAt<string>
  templateId?: ValueWithUpdatedAt<string>
}
