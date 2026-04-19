import {useCallback, useEffect, useState} from 'react'
import {api} from '../../api'
import type {
  PolicyImpactPreview,
  ProjectionPolicyValidation,
  ProjectionPolicyItem,
  SelectorGroupPreview,
  SelectorGroupItem,
  SelectorGroupStats,
  TdpPolicyCenterOverview,
  TerminalGroupMembershipItem,
  TerminalItem,
  TopicDecisionItem,
} from '../../types'

export function useTdpPolicyCenter(input: {
  terminals: TerminalItem[]
  onMutated?: () => Promise<void> | void
}) {
  const {terminals, onMutated} = input
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [groups, setGroups] = useState<SelectorGroupItem[]>([])
  const [policies, setPolicies] = useState<ProjectionPolicyItem[]>([])
  const [selectedTerminalId, setSelectedTerminalId] = useState('')
  const [memberships, setMemberships] = useState<TerminalGroupMembershipItem | null>(null)
  const [overview, setOverview] = useState<TdpPolicyCenterOverview | null>(null)
  const [groupPreview, setGroupPreview] = useState<SelectorGroupPreview | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [groupStats, setGroupStats] = useState<SelectorGroupStats | null>(null)
  const [policyValidation, setPolicyValidation] = useState<ProjectionPolicyValidation | null>(null)
  const [previewImpact, setPreviewImpact] = useState<PolicyImpactPreview | null>(null)
  const [topicDecision, setTopicDecision] = useState<TopicDecisionItem | null>(null)

  const reloadBase = useCallback(async () => {
    const [nextOverview, nextGroups, nextPolicies] = await Promise.all([
      api.getTdpPolicyCenterOverview(),
      api.getTdpGroups(),
      api.getTdpPolicies(),
    ])
    setOverview(nextOverview)
    setGroups(nextGroups)
    setPolicies(nextPolicies)
  }, [])

  const reloadGroupStats = useCallback(async (groupId: string) => {
    if (!groupId.trim()) {
      setGroupStats(null)
      return
    }
    setGroupStats(await api.getTdpGroupStats(groupId))
  }, [])

  const reloadMemberships = useCallback(async (terminalId: string) => {
    if (!terminalId.trim()) {
      setMemberships(null)
      return
    }
    setMemberships(await api.getTerminalGroupMemberships(terminalId))
  }, [])

  const reloadAll = useCallback(async (terminalId?: string) => {
    setLoading(true)
    setError('')
    try {
      await reloadBase()
      const targetTerminalId = terminalId ?? selectedTerminalId
      if (targetTerminalId.trim()) {
        await reloadMemberships(targetTerminalId)
      } else {
        setMemberships(null)
      }
      const targetGroupId = selectedGroupId || groups[0]?.groupId || ''
      if (targetGroupId.trim()) {
        await reloadGroupStats(targetGroupId)
      } else {
        setGroupStats(null)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载 TDP 策略中心失败')
    } finally {
      setLoading(false)
    }
  }, [groups, reloadBase, reloadGroupStats, reloadMemberships, selectedGroupId, selectedTerminalId])

  const runAction = useCallback(async (action: () => Promise<unknown>, successText: string, terminalId?: string) => {
    setError('')
    setMessage('')
    try {
      await action()
      await reloadAll(terminalId)
      await onMutated?.()
      setMessage(successText)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '操作失败')
    }
  }, [onMutated, reloadAll])

  useEffect(() => {
    if (!selectedTerminalId && terminals[0]?.terminalId) {
      setSelectedTerminalId(terminals[0].terminalId)
    }
  }, [selectedTerminalId, terminals])

  useEffect(() => {
    if (!selectedGroupId && groups[0]?.groupId) {
      setSelectedGroupId(groups[0].groupId)
    }
  }, [groups, selectedGroupId])

  useEffect(() => {
    void reloadAll(selectedTerminalId)
  }, [reloadAll, selectedTerminalId])

  return {
    loading,
    error,
    message,
    groups,
    policies,
    memberships,
    overview,
    groupPreview,
    setGroupPreview,
    selectedGroupId,
    setSelectedGroupId,
    groupStats,
    policyValidation,
    setPolicyValidation,
    previewImpact,
    setPreviewImpact,
    topicDecision,
    setTopicDecision,
    selectedTerminalId,
    setSelectedTerminalId,
    runAction,
    reloadAll,
    reloadGroupStats,
  }
}
