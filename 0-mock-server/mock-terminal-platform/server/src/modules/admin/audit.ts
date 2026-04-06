import { db } from '../../database/index.js'
import { auditLogsTable } from '../../database/schema.js'
import { DEFAULT_SANDBOX_ID } from '../../shared/constants.js'
import { createId, now, serializeJson } from '../../shared/utils.js'

export const appendAuditLog = (input: {
  domain: string
  action: string
  targetId: string
  detail: unknown
  operator?: string
}) => {
  db.insert(auditLogsTable).values({
    auditId: createId('audit'),
    sandboxId: DEFAULT_SANDBOX_ID,
    domain: input.domain,
    action: input.action,
    operator: input.operator ?? 'admin-console',
    targetId: input.targetId,
    detailJson: serializeJson(input.detail),
    createdAt: now(),
  }).run()
}
