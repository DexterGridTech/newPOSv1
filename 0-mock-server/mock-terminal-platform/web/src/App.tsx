import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { ActionButton, AppShell, DataTable, FormGrid, InlineBadge, JsonBlock, KeyValueList, Pager, Panel, SelectInput, StatCard, TextInput } from './components/ui'
import { TdpPolicyCenter } from './components/tdp-policy-center/TdpPolicyCenter'
import { HotUpdateCenter } from './components/hot-update/HotUpdateCenter'
import type {
  ActivationCodeItem,
  AuditLogItem,
  BrandItem,
  ChangeLogItem,
  CommandOutboxItem,
  ContractItem,
  FaultRuleItem,
  ImportValidationResult,
  OverviewStats,
  PlatformItem,
  ProfileItem,
  ProjectionItem,
  ProjectItem,
  RuntimeContext,
  SandboxItem,
  SceneTemplateItem,
  ScopeStats,
  SessionItem,
  StoreItem,
  TaskInstanceItem,
  TaskReleaseItem,
  TaskTrace,
  TenantItem,
  TemplateLibraryItem,
  TerminalItem,
  TerminalTemplateItem,
  TopicItem,
} from './types'

const sections = [
  { key: 'overview', label: '总览' },
  { key: 'tcp', label: 'TCP 控制面', children: [{ key: 'tcp-quick', label: '快捷控制台' }, { key: 'tcp-manual', label: '手动控制台' }] },
  { key: 'tdp', label: 'TDP 数据面' },
  { key: 'hot-update', label: '热更新' },
  { key: 'scene', label: '场景引擎' },
  { key: 'fault', label: '故障注入' },
  { key: 'master-data', label: '基础资料' },
] as const

const STORAGE_KEY = 'mock-terminal-platform:view-preferences'

type SectionKey = 'overview' | 'tcp' | 'tcp-quick' | 'tcp-manual' | 'tdp' | 'hot-update' | 'scene' | 'fault' | 'master-data'
type MasterTabKey = 'platforms' | 'projects' | 'tenants' | 'brands' | 'stores' | 'contracts' | 'profiles' | 'templates'

function formatTime(value?: number | null) {
  if (!value) return '--'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function isNumericActivationCode(value: string) {
  return /^\d{12}$/.test(value.trim())
}

export default function App() {
  const storedPrefs = (() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
        activeKey?: SectionKey
        terminalKeyword?: string
        taskKeyword?: string
        activationCodeKeyword?: string
        releaseKeyword?: string
      }
    } catch {
      return {}
    }
  })()

  const [activeKey, setActiveKey] = useState<SectionKey>(storedPrefs.activeKey ?? 'overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [terminalKeyword, setTerminalKeyword] = useState(storedPrefs.terminalKeyword ?? '')
  const [taskKeyword, setTaskKeyword] = useState(storedPrefs.taskKeyword ?? '')
  const [activationCodeKeyword, setActivationCodeKeyword] = useState(storedPrefs.activationCodeKeyword ?? '')
  const [releaseKeyword, setReleaseKeyword] = useState(storedPrefs.releaseKeyword ?? '')
  const [sessionTerminalId, setSessionTerminalId] = useState('T-1001')
  const [auditPage, setAuditPage] = useState(1)
  const [auditPageSize] = useState(10)
  const [auditTotalPages, setAuditTotalPages] = useState(1)

  const [overview, setOverview] = useState<OverviewStats | null>(null)
  const [runtimeContext, setRuntimeContext] = useState<RuntimeContext | null>(null)
  const [sandboxes, setSandboxes] = useState<SandboxItem[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
  const [topicLibrary, setTopicLibrary] = useState<TemplateLibraryItem[]>([])
  const [faultLibrary, setFaultLibrary] = useState<TemplateLibraryItem[]>([])
  const [importValidation, setImportValidation] = useState<ImportValidationResult | null>(null)
  const [terminals, setTerminals] = useState<TerminalItem[]>([])
  const [activationCodes, setActivationCodes] = useState<ActivationCodeItem[]>([])
  const [taskReleases, setTaskReleases] = useState<TaskReleaseItem[]>([])
  const [taskInstances, setTaskInstances] = useState<TaskInstanceItem[]>([])
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [topics, setTopics] = useState<TopicItem[]>([])
  const [scopeStats, setScopeStats] = useState<ScopeStats | null>(null)
  const [projections, setProjections] = useState<ProjectionItem[]>([])
  const [changeLogs, setChangeLogs] = useState<ChangeLogItem[]>([])
  const [commandOutbox, setCommandOutbox] = useState<CommandOutboxItem[]>([])
  const [sceneTemplates, setSceneTemplates] = useState<SceneTemplateItem[]>([])
  const [faultRules, setFaultRules] = useState<FaultRuleItem[]>([])
  const [platforms, setPlatforms] = useState<PlatformItem[]>([])
  const [tenants, setTenants] = useState<TenantItem[]>([])
  const [brands, setBrands] = useState<BrandItem[]>([])
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [stores, setStores] = useState<StoreItem[]>([])
  const [contracts, setContracts] = useState<ContractItem[]>([])
  const [profiles, setProfiles] = useState<ProfileItem[]>([])
  const [manualTemplates, setManualTemplates] = useState<TerminalTemplateItem[]>([])
  const [taskTrace, setTaskTrace] = useState<TaskTrace | null>(null)
  const [terminalSnapshot, setTerminalSnapshot] = useState<unknown>(null)
  const [terminalChanges, setTerminalChanges] = useState<unknown>(null)
  const [exportPayload, setExportPayload] = useState<unknown>(null)
  const [detailTitle, setDetailTitle] = useState('')
  const [detailPayload, setDetailPayload] = useState<unknown>(null)
  const [sceneDslDraft] = useState({
    version: 'draft-0.1',
    example: {
      name: 'upgrade-gray-scene',
      steps: [
        { type: 'select-terminals', selector: { tags: ['gray-upgrade'] } },
        { type: 'publish-task', taskType: 'APP_UPGRADE', payload: { targetVersion: '2.4.0' } },
        { type: 'observe', metrics: ['delivery', 'result', 'projection'] },
      ],
    },
  })

  const [topicKey, setTopicKey] = useState('terminal.runtime.config')
  const [topicName, setTopicName] = useState('终端运行时配置')
  const [topicScope, setTopicScope] = useState('TERMINAL')
  const [projectionPayload, setProjectionPayload] = useState('{"desiredVersion":"2.4.0","rollout":"gray"}')
  const [activationCodeInput, setActivationCodeInput] = useState('')
  const [faultName, setFaultName] = useState('升级任务超时模拟')
  const [faultMatcher, setFaultMatcher] = useState('{"taskType":"APP_UPGRADE"}')
  const [faultAction, setFaultAction] = useState('{"type":"TIMEOUT","timeoutMs":15000}')
  const [importJson, setImportJson] = useState('{"topics":[{"key":"terminal.debug.flag","name":"终端调试标记"}],"faultRules":[{"name":"配置延迟模板","targetType":"TDP_DELIVERY","matcher":{"taskType":"CONFIG_PUBLISH"},"action":{"type":"DELAY","durationMs":3000}}]}')

  const [sandboxDraftName, setSandboxDraftName] = useState('')
  const [sandboxDraftDescription, setSandboxDraftDescription] = useState('')
  const [sandboxDraftPurpose, setSandboxDraftPurpose] = useState('integration')
  const [sandboxDraftMode, setSandboxDraftMode] = useState('EMPTY')
  const [sandboxDraftSourceId, setSandboxDraftSourceId] = useState('')
  const [sandboxDraftLimits, setSandboxDraftLimits] = useState('{"maxTerminals":200,"maxTasks":1000,"maxFaultRules":100,"maxStorageSize":"2GB"}')
  const [editingSandboxId, setEditingSandboxId] = useState('')
  const [masterTab, setMasterTab] = useState<MasterTabKey>('platforms')
  const [selectedMasterPlatformId, setSelectedMasterPlatformId] = useState('')

  const [platformDraftCode, setPlatformDraftCode] = useState('')
  const [platformDraftName, setPlatformDraftName] = useState('')
  const [tenantDraftCode, setTenantDraftCode] = useState('')
  const [tenantDraftName, setTenantDraftName] = useState('')
  const [brandDraftCode, setBrandDraftCode] = useState('')
  const [brandDraftName, setBrandDraftName] = useState('')
  const [projectDraftCode, setProjectDraftCode] = useState('')
  const [projectDraftName, setProjectDraftName] = useState('')
  const [storeDraftTenantId, setStoreDraftTenantId] = useState('')
  const [storeDraftBrandId, setStoreDraftBrandId] = useState('')
  const [storeDraftProjectId, setStoreDraftProjectId] = useState('')
  const [storeDraftUnitCode, setStoreDraftUnitCode] = useState('')
  const [storeDraftCode, setStoreDraftCode] = useState('')
  const [storeDraftName, setStoreDraftName] = useState('')
  const [contractDraftProjectId, setContractDraftProjectId] = useState('')
  const [contractDraftTenantId, setContractDraftTenantId] = useState('')
  const [contractDraftBrandId, setContractDraftBrandId] = useState('')
  const [contractDraftStoreId, setContractDraftStoreId] = useState('')
  const [contractDraftCode, setContractDraftCode] = useState('')
  const [contractDraftUnitCode, setContractDraftUnitCode] = useState('')
  const [contractDraftStartDate, setContractDraftStartDate] = useState('2026-01-01')
  const [contractDraftEndDate, setContractDraftEndDate] = useState('2026-12-31')
  const [profileDraftCode, setProfileDraftCode] = useState('')
  const [profileDraftName, setProfileDraftName] = useState('')
  const [templateDraftCode, setTemplateDraftCode] = useState('')
  const [templateDraftProfileId, setTemplateDraftProfileId] = useState('')
  const [templateDraftName, setTemplateDraftName] = useState('')
  const [masterFocus, setMasterFocus] = useState<{ tab: MasterTabKey; keyword: string } | null>(null)
  const [manualActivationStoreId, setManualActivationStoreId] = useState('')
  const [manualActivationProfileId, setManualActivationProfileId] = useState('')
  const [manualActivationTemplateId, setManualActivationTemplateId] = useState('')
  const [manualActivationCount, setManualActivationCount] = useState('3')
  const [manualActivationCode, setManualActivationCode] = useState('')
  const [manualDeviceFingerprint, setManualDeviceFingerprint] = useState('manual-fingerprint-pos')
  const [manualTargetTerminalIds, setManualTargetTerminalIds] = useState('')
  const [manualTaskTitle, setManualTaskTitle] = useState('手动控制台-配置下发')
  const [manualTaskType, setManualTaskType] = useState<'CONFIG_PUBLISH' | 'APP_UPGRADE' | 'REMOTE_CONTROL'>('CONFIG_PUBLISH')
  const [manualTaskSourceId, setManualTaskSourceId] = useState('manual-source')
  const [manualTaskPayload, setManualTaskPayload] = useState('{"configVersion":"config-manual-001","mode":"full"}')
  const [editingMasterEntity, setEditingMasterEntity] = useState<null | { type: 'platform' | 'tenant' | 'brand' | 'project' | 'store' | 'contract' | 'profile' | 'template'; id: string }>(null)

  const resetSandboxScopedDetailState = () => {
    setTaskTrace(null)
    setTerminalSnapshot(null)
    setTerminalChanges(null)
    setExportPayload(null)
    setDetailTitle('')
    setDetailPayload(null)
    setImportValidation(null)
  }

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activeKey,
        terminalKeyword,
        taskKeyword,
        activationCodeKeyword,
        releaseKeyword,
      }),
    )
  }, [activeKey, terminalKeyword, taskKeyword, activationCodeKeyword, releaseKeyword])

  const reloadAll = async () => {
    setLoading(true)
    setError('')
    try {
      const [
        nextOverview,
        nextRuntimeContext,
        nextSandboxes,
        nextAuditLogs,
        nextTopicLibrary,
        nextFaultLibrary,
        nextTerminals,
        nextActivationCodes,
        nextTaskReleases,
        nextTaskInstances,
        nextSessions,
        nextTopics,
        nextScopeStats,
        nextProjections,
        nextChangeLogs,
        nextCommandOutbox,
        nextSceneTemplates,
        nextFaultRules,
        nextPlatforms,
        nextTenants,
        nextBrands,
        nextProjects,
        nextStores,
        nextContracts,
        nextProfiles,
        nextManualTemplates,
      ] = await Promise.all([
        api.getOverview(),
        api.getRuntimeContext(),
        api.getSandboxes(),
        api.getAuditLogs(auditPage, auditPageSize),
        api.getTopicLibrary(),
        api.getFaultLibrary(),
        api.getTerminals(),
        api.getActivationCodes(),
        api.getTaskReleases(),
        api.getTaskInstances(),
        api.getSessions(),
        api.getTopics(),
        api.getScopeStats(),
        api.getProjections(),
        api.getChangeLogs(),
        api.getCommandOutbox(),
        api.getSceneTemplates(),
        api.getFaultRules(),
        api.getPlatforms(),
        api.getTenants(),
        api.getBrands(),
        api.getProjects(),
        api.getStores(),
        api.getContracts(),
        api.getMasterProfiles(),
        api.getMasterTemplates(),
      ])

      api.setCurrentSandboxId(nextRuntimeContext.currentSandboxId)
      setOverview(nextOverview)
      setRuntimeContext(nextRuntimeContext)
      setSandboxes(nextSandboxes)
      setAuditLogs(nextAuditLogs.items)
      setAuditTotalPages(nextAuditLogs.totalPages)
      setTopicLibrary(nextTopicLibrary)
      setFaultLibrary(nextFaultLibrary)
      setTerminals(nextTerminals)
      setActivationCodes(nextActivationCodes)
      setTaskReleases(nextTaskReleases)
      setTaskInstances(nextTaskInstances)
      setSessions(nextSessions)
      setTopics(nextTopics)
      setScopeStats(nextScopeStats)
      setProjections(nextProjections)
      setChangeLogs(nextChangeLogs)
      setCommandOutbox(nextCommandOutbox)
      setSceneTemplates(nextSceneTemplates)
      setFaultRules(nextFaultRules)
      setPlatforms(nextPlatforms)
      setTenants(nextTenants)
      setBrands(nextBrands)
      setProjects(nextProjects)
      setStores(nextStores)
      setContracts(nextContracts)
      setProfiles(nextProfiles)
      setManualTemplates(nextManualTemplates)

      if (!activationCodeInput && nextActivationCodes[0]?.code) {
        setActivationCodeInput(nextActivationCodes[0].code)
      }
      if (nextTerminals[0]?.terminalId) {
        setSessionTerminalId(nextTerminals[0].terminalId)
      }
      if (!selectedMasterPlatformId && nextPlatforms[0]?.platformId) {
        setSelectedMasterPlatformId(nextPlatforms[0].platformId)
      }
      if (!storeDraftTenantId && nextTenants[0]?.tenantId) {
        setStoreDraftTenantId(nextTenants[0].tenantId)
      }
      if (!storeDraftBrandId && nextBrands[0]?.brandId) {
        setStoreDraftBrandId(nextBrands[0].brandId)
      }
      if (!storeDraftProjectId && nextProjects[0]?.projectId) {
        setStoreDraftProjectId(nextProjects[0].projectId)
      }
      if (!contractDraftProjectId && nextProjects[0]?.projectId) {
        setContractDraftProjectId(nextProjects[0].projectId)
      }
      if (!contractDraftTenantId && nextTenants[0]?.tenantId) {
        setContractDraftTenantId(nextTenants[0].tenantId)
      }
      if (!contractDraftBrandId && nextBrands[0]?.brandId) {
        setContractDraftBrandId(nextBrands[0].brandId)
      }
      if (!contractDraftStoreId && nextStores[0]?.storeId) {
        setContractDraftStoreId(nextStores[0].storeId)
      }
      if (!templateDraftProfileId && nextProfiles[0]?.profileId) {
        setTemplateDraftProfileId(nextProfiles[0].profileId)
      }
      if (!manualActivationStoreId && nextStores[0]?.storeId) {
        setManualActivationStoreId(nextStores[0].storeId)
      }
      if (!manualActivationProfileId && nextProfiles[0]?.profileId) {
        setManualActivationProfileId(nextProfiles[0].profileId)
      }
      if (!manualActivationTemplateId && nextManualTemplates[0]?.templateId) {
        setManualActivationTemplateId(nextManualTemplates[0].templateId)
      }
      if (!manualActivationCode && nextActivationCodes[0]?.code) {
        setManualActivationCode(nextActivationCodes[0].code)
      }
      if (!manualTargetTerminalIds && nextTerminals.length > 0) {
        setManualTargetTerminalIds(nextTerminals.slice(0, 2).map((item) => item.terminalId).join(','))
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reloadAll()
  }, [auditPage, auditPageSize])

  const filteredTerminals = useMemo(
    () => terminals.filter((item) => `${item.terminalId} ${item.storeId} ${item.healthStatus} ${item.lifecycleStatus} ${item.presenceStatus}`.toLowerCase().includes(terminalKeyword.toLowerCase())),
    [terminals, terminalKeyword],
  )

  const filteredTaskInstances = useMemo(
    () => taskInstances.filter((item) => `${item.instanceId} ${item.releaseId} ${item.terminalId} ${item.taskType} ${item.status} ${item.deliveryStatus}`.toLowerCase().includes(taskKeyword.toLowerCase())),
    [taskInstances, taskKeyword],
  )

  const filteredActivationCodes = useMemo(
    () => activationCodes.filter((item) => `${item.code} ${item.storeId} ${item.projectId ?? ''} ${item.status} ${item.usedBy ?? ''}`.toLowerCase().includes(activationCodeKeyword.toLowerCase())),
    [activationCodes, activationCodeKeyword],
  )

  const filteredTaskReleases = useMemo(
    () => taskReleases.filter((item) => `${item.releaseId} ${item.title} ${item.taskType} ${item.status} ${item.sourceId}`.toLowerCase().includes(releaseKeyword.toLowerCase())),
    [taskReleases, releaseKeyword],
  )

  const onlineTerminals = useMemo(() => terminals.filter((item) => item.presenceStatus === 'ONLINE'), [terminals])
  const activationCodeInputValid = !activationCodeInput.trim() || isNumericActivationCode(activationCodeInput)
  const manualActivationCodeValid = !manualActivationCode.trim() || isNumericActivationCode(manualActivationCode)
  const selectedActivationCode = filteredActivationCodes[0] ?? activationCodes[0]
  const selectedTerminal = filteredTerminals[0] ?? terminals[0]
  const selectedRelease = filteredTaskReleases[0] ?? taskReleases[0]
  const selectedInstance = filteredTaskInstances[0] ?? taskInstances[0]
  const selectedProjection = projections[0]
  const selectedChangeLog = changeLogs[0]
  const selectedSession = sessions[0]
  const quickActionTerminals = filteredTerminals.length ? filteredTerminals : terminals
  const currentMasterPlatformId = selectedMasterPlatformId || platforms[0]?.platformId || ''
  const currentMasterPlatform = platforms.find((item) => item.platformId === currentMasterPlatformId) ?? null
  const platformScopedTenants = currentMasterPlatformId ? tenants.filter((item) => item.platformId === currentMasterPlatformId) : tenants
  const platformScopedBrands = currentMasterPlatformId ? brands.filter((item) => item.platformId === currentMasterPlatformId) : brands
  const platformScopedProjects = currentMasterPlatformId ? projects.filter((item) => item.platformId === currentMasterPlatformId) : projects
  const platformScopedStores = currentMasterPlatformId ? stores.filter((item) => item.platformId === currentMasterPlatformId) : stores
  const platformScopedContracts = currentMasterPlatformId ? contracts.filter((item) => item.platformId === currentMasterPlatformId) : contracts

  useEffect(() => {
    const nextStoreProjectId = platformScopedProjects.find((item) => item.projectId === storeDraftProjectId)?.projectId ?? platformScopedProjects[0]?.projectId ?? ''
    if (nextStoreProjectId !== storeDraftProjectId) {
      setStoreDraftProjectId(nextStoreProjectId)
    }
    const nextContractProjectId = platformScopedProjects.find((item) => item.projectId === contractDraftProjectId)?.projectId ?? platformScopedProjects[0]?.projectId ?? ''
    if (nextContractProjectId !== contractDraftProjectId) {
      setContractDraftProjectId(nextContractProjectId)
    }
  }, [platformScopedProjects, storeDraftProjectId, contractDraftProjectId])

  useEffect(() => {
    const nextStoreTenantId = platformScopedTenants.find((item) => item.tenantId === storeDraftTenantId)?.tenantId ?? platformScopedTenants[0]?.tenantId ?? ''
    if (nextStoreTenantId !== storeDraftTenantId) {
      setStoreDraftTenantId(nextStoreTenantId)
    }
    const nextContractTenantId = platformScopedTenants.find((item) => item.tenantId === contractDraftTenantId)?.tenantId ?? platformScopedTenants[0]?.tenantId ?? ''
    if (nextContractTenantId !== contractDraftTenantId) {
      setContractDraftTenantId(nextContractTenantId)
    }
  }, [platformScopedTenants, storeDraftTenantId, contractDraftTenantId])

  useEffect(() => {
    const nextStoreBrandId = platformScopedBrands.find((item) => item.brandId === storeDraftBrandId)?.brandId ?? platformScopedBrands[0]?.brandId ?? ''
    if (nextStoreBrandId !== storeDraftBrandId) {
      setStoreDraftBrandId(nextStoreBrandId)
    }
    const nextContractBrandId = platformScopedBrands.find((item) => item.brandId === contractDraftBrandId)?.brandId ?? platformScopedBrands[0]?.brandId ?? ''
    if (nextContractBrandId !== contractDraftBrandId) {
      setContractDraftBrandId(nextContractBrandId)
    }
  }, [platformScopedBrands, storeDraftBrandId, contractDraftBrandId])

  useEffect(() => {
    const nextContractStoreId = platformScopedStores.find((item) => item.storeId === contractDraftStoreId)?.storeId ?? platformScopedStores[0]?.storeId ?? ''
    if (nextContractStoreId !== contractDraftStoreId) {
      setContractDraftStoreId(nextContractStoreId)
    }
  }, [platformScopedStores, contractDraftStoreId])

  useEffect(() => {
    if (!selectedInstance) return
    void api.getTaskTrace(selectedInstance.instanceId).then(setTaskTrace).catch(() => setTaskTrace(null))
  }, [selectedInstance?.instanceId])

  useEffect(() => {
    const terminalId = filteredTerminals[0]?.terminalId ?? terminals[0]?.terminalId
    if (!terminalId) return
    void Promise.all([api.getTerminalSnapshot(terminalId), api.getTerminalChanges(terminalId)])
      .then(([snapshot, changes]) => {
        setTerminalSnapshot(snapshot)
        setTerminalChanges(changes)
      })
      .catch(() => {
        setTerminalSnapshot(null)
        setTerminalChanges(null)
      })
  }, [filteredTerminals, terminals])

  const downloadExportFile = () => {
    window.open(api.buildExportDownloadUrl(), '_blank', 'noopener,noreferrer')
  }

  const buildPlatformDetail = (platformId: string) => {
    const platform = platforms.find((item) => item.platformId === platformId)
    if (!platform) return null
    const relatedProjects = projects.filter((item) => item.platformId === platformId)
    const relatedTenants = tenants.filter((item) => item.platformId === platformId)
    const relatedBrands = brands.filter((item) => item.platformId === platformId)
    const relatedStores = stores.filter((item) => item.platformId === platformId)
    const relatedContracts = contracts.filter((item) => item.platformId === platformId)

    return {
      platform,
      relations: {
        projects: relatedProjects.map((item) => ({ projectId: item.projectId, projectName: item.projectName })),
        tenants: relatedTenants.map((item) => ({ tenantId: item.tenantId, tenantName: item.tenantName })),
        brands: relatedBrands.map((item) => ({ brandId: item.brandId, brandName: item.brandName })),
        stores: relatedStores.map((item) => ({ storeId: item.storeId, storeName: item.storeName, unitCode: item.unitCode })),
        contracts: relatedContracts.map((item) => ({ contractId: item.contractId, contractCode: item.contractCode, storeName: item.storeName })),
      },
    }
  }

  const buildTenantDetail = (tenantId: string) => {
    const tenant = tenants.find((item) => item.tenantId === tenantId)
    if (!tenant) return null
    const relatedStores = stores.filter((item) => item.tenantId === tenantId)
    const relatedBrandIds = [...new Set(relatedStores.map((item) => item.brandId))]
    const relatedProjectIds = [...new Set(relatedStores.map((item) => item.projectId))]

    return {
      tenant,
      relations: {
        brands: brands.filter((item) => relatedBrandIds.includes(item.brandId)).map((item) => ({ brandId: item.brandId, brandName: item.brandName })),
        projects: projects.filter((item) => relatedProjectIds.includes(item.projectId)).map((item) => ({ projectId: item.projectId, projectName: item.projectName })),
        stores: relatedStores.map((item) => ({ storeId: item.storeId, storeName: item.storeName })),
      },
    }
  }

  const buildBrandDetail = (brandId: string) => {
    const brand = brands.find((item) => item.brandId === brandId)
    if (!brand) return null
    const relatedStores = stores.filter((item) => item.brandId === brandId)
    const relatedProjectIds = [...new Set(relatedStores.map((item) => item.projectId))]
    const relatedTenantIds = [...new Set(relatedStores.map((item) => item.tenantId))]

    return {
      brand,
      relations: {
        tenants: tenants.filter((item) => relatedTenantIds.includes(item.tenantId)).map((item) => ({ tenantId: item.tenantId, tenantName: item.tenantName })),
        projects: projects.filter((item) => relatedProjectIds.includes(item.projectId)).map((item) => ({ projectId: item.projectId, projectName: item.projectName })),
        stores: relatedStores.map((item) => ({ storeId: item.storeId, storeName: item.storeName })),
      },
    }
  }

  const buildProjectDetail = (projectId: string) => {
    const project = projects.find((item) => item.projectId === projectId)
    if (!project) return null
    const relatedStores = stores.filter((item) => item.projectId === projectId)
    const relatedTerminals = terminals.filter((item) => item.projectId === projectId)
    const relatedActivationCodes = activationCodes.filter((item) => item.projectId === projectId)
    const relatedTenantIds = [...new Set(relatedStores.map((item) => item.tenantId))]
    const relatedBrandIds = [...new Set(relatedStores.map((item) => item.brandId))]

    return {
      project,
      relations: {
        tenants: tenants.filter((item) => relatedTenantIds.includes(item.tenantId)).map((item) => ({ tenantId: item.tenantId, tenantName: item.tenantName })),
        brands: brands.filter((item) => relatedBrandIds.includes(item.brandId)).map((item) => ({ brandId: item.brandId, brandName: item.brandName })),
        stores: relatedStores.map((item) => ({ storeId: item.storeId, storeName: item.storeName })),
        terminals: relatedTerminals.map((item) => ({ terminalId: item.terminalId, storeId: item.storeId, healthStatus: item.healthStatus })),
        activationCodes: relatedActivationCodes.map((item) => ({ code: item.code, storeId: item.storeId, status: item.status })),
      },
    }
  }

  const buildStoreDetail = (storeId: string) => {
    const store = stores.find((item) => item.storeId === storeId)
    if (!store) return null
    const relatedActivationCodes = activationCodes.filter((item) => item.storeId === storeId)
    const relatedTerminals = terminals.filter((item) => item.storeId === storeId)
    const relatedTaskInstances = taskInstances.filter((item) => relatedTerminals.some((terminal) => terminal.terminalId === item.terminalId))

    return {
      store,
      platform: platforms.find((item) => item.platformId === store.platformId) ?? null,
      tenant: tenants.find((item) => item.tenantId === store.tenantId) ?? null,
      brand: brands.find((item) => item.brandId === store.brandId) ?? null,
      project: projects.find((item) => item.projectId === store.projectId) ?? null,
      relations: {
        contracts: contracts.filter((item) => item.storeId === storeId).map((item) => ({ contractId: item.contractId, contractCode: item.contractCode, unitCode: item.unitCode })),
        activationCodes: relatedActivationCodes.map((item) => ({ code: item.code, status: item.status, templateId: item.templateId })),
        terminals: relatedTerminals.map((item) => ({ terminalId: item.terminalId, lifecycleStatus: item.lifecycleStatus, healthStatus: item.healthStatus })),
        taskInstances: relatedTaskInstances.map((item) => ({ instanceId: item.instanceId, terminalId: item.terminalId, status: item.status, deliveryStatus: item.deliveryStatus })),
      },
    }
  }

  const buildContractDetail = (contractId: string) => {
    const contract = contracts.find((item) => item.contractId === contractId)
    if (!contract) return null
    return {
      contract,
      platform: platforms.find((item) => item.platformId === contract.platformId) ?? null,
      project: projects.find((item) => item.projectId === contract.projectId) ?? null,
      tenant: tenants.find((item) => item.tenantId === contract.tenantId) ?? null,
      brand: brands.find((item) => item.brandId === contract.brandId) ?? null,
      store: stores.find((item) => item.storeId === contract.storeId) ?? null,
    }
  }

  const selectedStoreDraftProject = platformScopedProjects.find((item) => item.projectId === storeDraftProjectId) ?? null
  const selectedStoreDraftTenant = platformScopedTenants.find((item) => item.tenantId === storeDraftTenantId) ?? null
  const selectedStoreDraftBrand = platformScopedBrands.find((item) => item.brandId === storeDraftBrandId) ?? null
  const selectedContractDraftStore = platformScopedStores.find((item) => item.storeId === contractDraftStoreId) ?? null

  const buildProfileDetail = (profileId: string) => {
    const profile = profiles.find((item) => item.profileId === profileId)
    if (!profile) return null
    const relatedTemplates = manualTemplates.filter((item) => item.profileId === profileId)
    const relatedActivationCodes = activationCodes.filter((item) => item.profileId === profileId)
    const relatedTerminals = terminals.filter((item) => item.profileId === profileId)

    return {
      profile,
      relations: {
        templates: relatedTemplates.map((item) => ({ templateId: item.templateId, name: item.name })),
        activationCodes: relatedActivationCodes.map((item) => ({ code: item.code, status: item.status, storeId: item.storeId })),
        terminals: relatedTerminals.map((item) => ({ terminalId: item.terminalId, storeId: item.storeId, lifecycleStatus: item.lifecycleStatus })),
      },
    }
  }

  const buildTemplateDetail = (templateId: string) => {
    const template = manualTemplates.find((item) => item.templateId === templateId)
    if (!template) return null
    const relatedProfile = profiles.find((item) => item.profileId === template.profileId) ?? null
    const relatedActivationCodes = activationCodes.filter((item) => item.templateId === templateId)
    const relatedTerminals = terminals.filter((item) => item.templateId === templateId)

    return {
      template,
      parentProfile: relatedProfile,
      relations: {
        activationCodes: relatedActivationCodes.map((item) => ({ code: item.code, status: item.status, storeId: item.storeId })),
        terminals: relatedTerminals.map((item) => ({ terminalId: item.terminalId, storeId: item.storeId, healthStatus: item.healthStatus })),
      },
    }
  }

  const buildActivationCodeDetail = (code: string) => {
    const activationCode = activationCodes.find((item) => item.code === code)
    if (!activationCode) return null
    const relatedStore = stores.find((item) => item.storeId === activationCode.storeId) ?? null
    const relatedProject = projects.find((item) => item.projectId === activationCode.projectId) ?? null
    const relatedProfile = profiles.find((item) => item.profileId === activationCode.profileId) ?? null
    const relatedTemplate = manualTemplates.find((item) => item.templateId === activationCode.templateId) ?? null
    const boundTerminal = terminals.find((item) => item.terminalId === activationCode.usedBy) ?? null

    return {
      activationCode,
      store: relatedStore,
      project: relatedProject,
      profile: relatedProfile,
      template: relatedTemplate,
      usedByTerminal: boundTerminal,
    }
  }

  const buildTerminalDetail = (terminalId: string) => {
    const terminal = terminals.find((item) => item.terminalId === terminalId)
    if (!terminal) return null
    const relatedStore = stores.find((item) => item.storeId === terminal.storeId) ?? null
    const relatedProject = projects.find((item) => item.projectId === terminal.projectId) ?? null
    const relatedProfile = profiles.find((item) => item.profileId === terminal.profileId) ?? null
    const relatedTemplate = manualTemplates.find((item) => item.templateId === terminal.templateId) ?? null
    const relatedSession = sessions.find((item) => item.terminalId === terminalId) ?? null
    const relatedTaskInstances = taskInstances.filter((item) => item.terminalId === terminalId)

    return {
      terminal,
      store: relatedStore,
      project: relatedProject,
      profile: relatedProfile,
      template: relatedTemplate,
      session: relatedSession,
      relations: {
        taskInstances: relatedTaskInstances.map((item) => ({ instanceId: item.instanceId, status: item.status, deliveryStatus: item.deliveryStatus })),
        snapshot: terminalSnapshot,
        changes: terminalChanges,
      },
    }
  }

  const buildTaskReleaseDetail = (releaseId: string) => {
    const release = taskReleases.find((item) => item.releaseId === releaseId)
    if (!release) return null
    const relatedInstances = taskInstances.filter((item) => item.releaseId === releaseId)
    const relatedTerminals = terminals.filter((terminal) => relatedInstances.some((instance) => instance.terminalId === terminal.terminalId))

    return {
      release,
      relations: {
        instances: relatedInstances.map((item) => ({ instanceId: item.instanceId, terminalId: item.terminalId, status: item.status, deliveryStatus: item.deliveryStatus })),
        targetTerminals: relatedTerminals.map((item) => ({ terminalId: item.terminalId, storeId: item.storeId, healthStatus: item.healthStatus })),
      },
    }
  }

  const buildTaskInstanceDetail = (instanceId: string) => {
    const instance = taskInstances.find((item) => item.instanceId === instanceId)
    if (!instance) return null
    const relatedRelease = taskReleases.find((item) => item.releaseId === instance.releaseId) ?? null
    const relatedTerminal = terminals.find((item) => item.terminalId === instance.terminalId) ?? null

    return {
      instance,
      release: relatedRelease,
      terminal: relatedTerminal,
      trace: taskTrace,
    }
  }

  const loadTenantForEdit = (tenantId: string) => {
    const tenant = tenants.find((item) => item.tenantId === tenantId)
    if (!tenant) return
    setSelectedMasterPlatformId(tenant.platformId)
    setTenantDraftCode(tenant.tenantCode)
    setTenantDraftName(tenant.tenantName)
    setEditingMasterEntity({ type: 'tenant', id: tenantId })
    setMasterTab('tenants')
  }

  const loadBrandForEdit = (brandId: string) => {
    const brand = brands.find((item) => item.brandId === brandId)
    if (!brand) return
    setSelectedMasterPlatformId(brand.platformId)
    setBrandDraftCode(brand.brandCode)
    setBrandDraftName(brand.brandName)
    setEditingMasterEntity({ type: 'brand', id: brandId })
    setMasterTab('brands')
  }

  const loadProjectForEdit = (projectId: string) => {
    const project = projects.find((item) => item.projectId === projectId)
    if (!project) return
    setSelectedMasterPlatformId(project.platformId)
    setProjectDraftCode(project.projectCode)
    setProjectDraftName(project.projectName)
    setEditingMasterEntity({ type: 'project', id: projectId })
    setMasterTab('projects')
  }

  const loadStoreForEdit = (storeId: string) => {
    const store = stores.find((item) => item.storeId === storeId)
    if (!store) return
    setSelectedMasterPlatformId(store.platformId)
    setStoreDraftTenantId(store.tenantId)
    setStoreDraftBrandId(store.brandId)
    setStoreDraftProjectId(store.projectId)
    setStoreDraftUnitCode(store.unitCode)
    setStoreDraftCode(store.storeCode)
    setStoreDraftName(store.storeName)
    setEditingMasterEntity({ type: 'store', id: storeId })
    setMasterTab('stores')
  }

  const loadPlatformForEdit = (platformId: string) => {
    const platform = platforms.find((item) => item.platformId === platformId)
    if (!platform) return
    setSelectedMasterPlatformId(platform.platformId)
    setPlatformDraftCode(platform.platformCode)
    setPlatformDraftName(platform.platformName)
    setEditingMasterEntity({ type: 'platform', id: platformId })
    setMasterTab('platforms')
  }

  const loadContractForEdit = (contractId: string) => {
    const contract = contracts.find((item) => item.contractId === contractId)
    if (!contract) return
    setSelectedMasterPlatformId(contract.platformId)
    setContractDraftProjectId(contract.projectId)
    setContractDraftTenantId(contract.tenantId)
    setContractDraftBrandId(contract.brandId)
    setContractDraftStoreId(contract.storeId)
    setContractDraftCode(contract.contractCode)
    setContractDraftUnitCode(contract.unitCode)
    setContractDraftStartDate(contract.startDate ?? '')
    setContractDraftEndDate(contract.endDate ?? '')
    setEditingMasterEntity({ type: 'contract', id: contractId })
    setMasterTab('contracts')
  }

  const loadProfileForEdit = (profileId: string) => {
    const profile = profiles.find((item) => item.profileId === profileId)
    if (!profile) return
    setProfileDraftCode(profile.profileCode)
    setProfileDraftName(profile.name)
    setEditingMasterEntity({ type: 'profile', id: profileId })
    setMasterTab('profiles')
  }

  const loadTemplateForEdit = (templateId: string) => {
    const template = manualTemplates.find((item) => item.templateId === templateId)
    if (!template) return
    setTemplateDraftCode(template.templateCode)
    setTemplateDraftProfileId(template.profileId)
    setTemplateDraftName(template.name)
    setEditingMasterEntity({ type: 'template', id: templateId })
    setMasterTab('templates')
  }

  const openDetail = (title: string, payload: unknown) => {
    setDetailTitle(title)
    setDetailPayload(payload)
  }

  const closeDetail = () => {
    setDetailTitle('')
    setDetailPayload(null)
  }

  const renderDetailContent = () => {
    if (!detailPayload || typeof detailPayload !== 'object' || Array.isArray(detailPayload)) {
      return <JsonBlock value={detailPayload} />
    }

    const payload = detailPayload as Record<string, unknown>
    const summaryEntries = Object.entries(payload).filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value))
    const relationEntries = Object.entries(payload).filter(([, value]) => Array.isArray(value) || (value && typeof value === 'object' && ('relations' in (payload as object) ? false : false)))

    const summaryCards = summaryEntries.slice(0, 4).map(([key, value]) => ({
      label: key,
      value: JSON.stringify(value, null, 2),
    }))

    const relations = 'relations' in payload && payload.relations && typeof payload.relations === 'object'
      ? Object.entries(payload.relations as Record<string, unknown>)
      : []

    const detailActions: Array<JSX.Element> = []

    if (payload.platform && typeof payload.platform === 'object' && 'platformId' in (payload.platform as Record<string, unknown>)) {
      const platform = payload.platform as PlatformItem
      detailActions.push(<ActionButton key="edit-platform" label="编辑平台" onClick={() => { closeDetail(); loadPlatformForEdit(platform.platformId); jumpToMasterTab('platforms', platform.platformName) }} />)
    }
    if (payload.contract && typeof payload.contract === 'object' && 'contractId' in (payload.contract as Record<string, unknown>)) {
      const contract = payload.contract as ContractItem
      detailActions.push(<ActionButton key="edit-contract" label="编辑合同" onClick={() => { closeDetail(); loadContractForEdit(contract.contractId); jumpToMasterTab('contracts', contract.contractCode) }} />)
    }
    if (payload.tenant && typeof payload.tenant === 'object' && 'tenantId' in (payload.tenant as Record<string, unknown>)) {
      const tenant = payload.tenant as TenantItem
      detailActions.push(<ActionButton key="edit-tenant" label="编辑租户" onClick={() => { closeDetail(); loadTenantForEdit(tenant.tenantId); jumpToMasterTab('tenants', tenant.tenantName) }} />)
    }
    if (payload.brand && typeof payload.brand === 'object' && 'brandId' in (payload.brand as Record<string, unknown>)) {
      const brand = payload.brand as BrandItem
      detailActions.push(<ActionButton key="edit-brand" label="编辑品牌" onClick={() => { closeDetail(); loadBrandForEdit(brand.brandId); jumpToMasterTab('brands', brand.brandName) }} />)
    }
    if (payload.project && typeof payload.project === 'object' && 'projectId' in (payload.project as Record<string, unknown>)) {
      const project = payload.project as ProjectItem
      detailActions.push(<ActionButton key="edit-project" label="编辑项目" onClick={() => { closeDetail(); loadProjectForEdit(project.projectId); jumpToMasterTab('projects', project.projectName) }} />)
    }
    if (payload.store && typeof payload.store === 'object' && 'storeId' in (payload.store as Record<string, unknown>)) {
      const store = payload.store as StoreItem
      detailActions.push(
        <ActionButton key="edit-store" label="编辑门店" onClick={() => { closeDetail(); loadStoreForEdit(store.storeId); jumpToMasterTab('stores', store.storeName) }} />,
        <ActionButton key="prepare-code" label="生成该门店激活码" onClick={() => { closeDetail(); setActiveKey('tcp-manual'); setManualActivationStoreId(store.storeId) }} />,
      )
    }
    if (payload.profile && typeof payload.profile === 'object' && 'profileId' in (payload.profile as Record<string, unknown>)) {
      const profile = payload.profile as ProfileItem
      detailActions.push(<ActionButton key="edit-profile" label="编辑 Profile" onClick={() => { closeDetail(); loadProfileForEdit(profile.profileId); jumpToMasterTab('profiles', profile.name) }} />)
    }
    if (payload.template && typeof payload.template === 'object' && 'templateId' in (payload.template as Record<string, unknown>)) {
      const template = payload.template as TerminalTemplateItem
      detailActions.push(<ActionButton key="edit-template" label="编辑 Template" onClick={() => { closeDetail(); loadTemplateForEdit(template.templateId); jumpToMasterTab('templates', template.name) }} />)
    }
    if (payload.activationCode && typeof payload.activationCode === 'object' && 'code' in (payload.activationCode as Record<string, unknown>)) {
      const activationCode = payload.activationCode as ActivationCodeItem
      detailActions.push(
        <ActionButton key="use-code" label="用此激活码激活" onClick={() => { closeDetail(); setActiveKey('tcp-manual'); setManualActivationCode(activationCode.code); setActivationCodeKeyword(activationCode.code) }} />,
        <ActionButton key="focus-code-list" label="在列表中查看" onClick={() => { closeDetail(); setActiveKey('tcp-manual'); setActivationCodeKeyword(activationCode.code) }} />,
      )
    }
    if (payload.terminal && typeof payload.terminal === 'object' && 'terminalId' in (payload.terminal as Record<string, unknown>)) {
      const terminal = payload.terminal as TerminalItem
      detailActions.push(
        <ActionButton key="focus-terminal-task" label="对该终端发任务" onClick={() => { closeDetail(); setActiveKey('tcp-manual'); setManualTargetTerminalIds(terminal.terminalId); setTerminalKeyword(terminal.terminalId) }} />,
        <ActionButton key="focus-terminal-list" label="在列表中查看" onClick={() => { closeDetail(); setActiveKey('tcp-manual'); setTerminalKeyword(terminal.terminalId) }} />,
        <ActionButton key="set-warning" label="设为告警" tone="danger" onClick={() => { closeDetail(); void runAction(() => api.forceTerminalStatus(terminal.terminalId, { presenceStatus: terminal.presenceStatus, healthStatus: 'WARNING' }), `已更新终端 ${terminal.terminalId}`) }} />,
      )
    }
    if (payload.release && typeof payload.release === 'object' && 'releaseId' in (payload.release as Record<string, unknown>)) {
      const release = payload.release as TaskReleaseItem
      detailActions.push(
        <ActionButton key="view-release-instances" label="查看相关实例" onClick={() => { closeDetail(); setActiveKey('tcp-manual'); setTaskKeyword(release.releaseId); setReleaseKeyword(release.releaseId) }} />,
        <ActionButton key="focus-release-list" label="在发布单中查看" onClick={() => { closeDetail(); setActiveKey('tcp-manual'); setReleaseKeyword(release.releaseId) }} />,
      )
    }
    if (payload.instance && typeof payload.instance === 'object' && 'instanceId' in (payload.instance as Record<string, unknown>)) {
      const instance = payload.instance as TaskInstanceItem
      detailActions.push(
        <ActionButton key="mock-instance-success" label="写入成功结果" onClick={() => { closeDetail(); void runAction(() => api.mockTaskResult(instance.instanceId, { status: 'SUCCESS', result: { message: 'detail action success', finishedBy: 'detail-drawer' } }), `已写入实例 ${instance.instanceId} 结果`) }} />,
        <ActionButton key="focus-instance-list" label="在实例中查看" onClick={() => { closeDetail(); setActiveKey('tcp-manual'); setTaskKeyword(instance.instanceId) }} />,
      )
    }
    if (payload.usedByTerminal && typeof payload.usedByTerminal === 'object' && 'terminalId' in (payload.usedByTerminal as Record<string, unknown>)) {
      const usedByTerminal = payload.usedByTerminal as TerminalItem
      detailActions.push(<ActionButton key="goto-used-terminal" label="查看绑定终端" onClick={() => { closeDetail(); jumpToTerminal(usedByTerminal.terminalId) }} />)
    }
    if (payload.parentProject && typeof payload.parentProject === 'object' && 'projectId' in (payload.parentProject as Record<string, unknown>)) {
      const parentProject = payload.parentProject as ProjectItem
      detailActions.push(<ActionButton key="goto-parent-project" label="查看所属项目" onClick={() => { closeDetail(); jumpToProject(parentProject.projectId) }} />)
    }
    if (payload.parentProfile && typeof payload.parentProfile === 'object' && 'profileId' in (payload.parentProfile as Record<string, unknown>)) {
      const parentProfile = payload.parentProfile as ProfileItem
      detailActions.push(<ActionButton key="goto-parent-profile" label="查看适用机型" onClick={() => { closeDetail(); jumpToProfile(parentProfile.profileId) }} />)
    }
    if (payload.project && typeof payload.project === 'object' && 'projectId' in (payload.project as Record<string, unknown>)) {
      const project = payload.project as ProjectItem
      detailActions.push(<ActionButton key="goto-project" label="查看关联项目" onClick={() => { closeDetail(); jumpToProject(project.projectId) }} />)
    }
    if (payload.store && typeof payload.store === 'object' && 'storeId' in (payload.store as Record<string, unknown>)) {
      const store = payload.store as StoreItem
      detailActions.push(<ActionButton key="goto-store" label="查看关联门店" onClick={() => { closeDetail(); jumpToStore(store.storeId) }} />)
    }
    if (payload.profile && typeof payload.profile === 'object' && 'profileId' in (payload.profile as Record<string, unknown>)) {
      const profile = payload.profile as ProfileItem
      detailActions.push(<ActionButton key="goto-profile" label="查看关联 Profile" onClick={() => { closeDetail(); jumpToProfile(profile.profileId) }} />)
    }
    if (payload.template && typeof payload.template === 'object' && 'templateId' in (payload.template as Record<string, unknown>)) {
      const template = payload.template as TerminalTemplateItem
      detailActions.push(<ActionButton key="goto-template" label="查看关联 Template" onClick={() => { closeDetail(); jumpToTemplate(template.templateId) }} />)
    }
    if (payload.release && typeof payload.release === 'object' && 'releaseId' in (payload.release as Record<string, unknown>)) {
      const release = payload.release as TaskReleaseItem
      detailActions.push(<ActionButton key="goto-release" label="查看关联发布单" onClick={() => { closeDetail(); jumpToRelease(release.releaseId) }} />)
    }

    return (
      <div className="detail-layout">
        {detailActions.length ? (
          <Panel title="快捷动作" subtitle="在详情页直接跳转或执行最常用的对象级操作">
            <div className="button-group">{detailActions}</div>
          </Panel>
        ) : null}

        {summaryCards.length ? (
          <Panel title="摘要" subtitle="当前对象与直接上下文">
            <KeyValueList items={summaryCards.map((item) => ({ label: item.label, value: <code>{item.value}</code> }))} />
          </Panel>
        ) : null}

        {relations.length ? (
          <Panel title="关联关系" subtitle="当前对象的上下游对象和链路结果">
            <div className="detail-relation-grid">
              {relations.map(([key, value]) => (
                <div key={key} className="detail-relation-block">
                  <h3>{key}</h3>
                  {Array.isArray(value) ? <JsonBlock value={value} /> : <JsonBlock value={value} />}
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        <Panel title="完整载荷" subtitle="保留原始调试 JSON，便于深度排查">
          <JsonBlock value={detailPayload} />
        </Panel>
      </div>
    )
  }

  const applyTopicTemplate = (template: TemplateLibraryItem) => {
    setTopicKey(template.key ?? '')
    setTopicName(template.name)
    setTopicScope(template.scopeType ?? 'TERMINAL')
    setProjectionPayload(JSON.stringify({ fromTemplate: template.templateId }, null, 2))
    setMessage(`已套用 Topic 模板：${template.name}`)
  }

  const applyFaultTemplate = (template: TemplateLibraryItem) => {
    setFaultName(template.name)
    setFaultMatcher(JSON.stringify(template.matcher ?? {}, null, 2))
    setFaultAction(JSON.stringify(template.action ?? {}, null, 2))
    setMessage(`已套用 Fault 模板：${template.name}`)
  }

  const runAction = async (action: () => Promise<unknown>, successText: string) => {
    try {
      setMessage('')
      setError('')
      await action()
      setMessage(successText)
      await reloadAll()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '操作失败')
    }
  }

  const clearEditingIfMatched = (type: NonNullable<typeof editingMasterEntity>['type'], id: string) => {
    if (editingMasterEntity?.type === type && editingMasterEntity.id === id) {
      setEditingMasterEntity(null)
    }
  }

  const deleteMasterEntity = async (
    type: NonNullable<typeof editingMasterEntity>['type'],
    id: string,
    action: () => Promise<unknown>,
    successText: string,
  ) => {
    await runAction(async () => {
      clearEditingIfMatched(type, id)
      await action()
    }, successText)
  }

  const emptyTerminals = filteredTerminals.length === 0
  const emptyTasks = filteredTaskInstances.length === 0
  const emptyActivationCodes = filteredActivationCodes.length === 0
  const emptyReleases = filteredTaskReleases.length === 0

  const jumpToMasterTab = (tab: MasterTabKey, keyword: string) => {
    setActiveKey('master-data')
    setMasterTab(tab)
    setMasterFocus({ tab, keyword })
  }

  const jumpToPlatform = (platformId?: string | null) => {
    if (!platformId) return
    const platform = platforms.find((item) => item.platformId === platformId)
    if (platform) setSelectedMasterPlatformId(platform.platformId)
    jumpToMasterTab('platforms', platform?.platformName ?? platformId)
  }

  const jumpToStore = (storeId?: string | null) => {
    if (!storeId) return
    const store = stores.find((item) => item.storeId === storeId)
    if (store) setSelectedMasterPlatformId(store.platformId)
    jumpToMasterTab('stores', store?.storeName ?? store?.storeCode ?? storeId)
  }

  const jumpToProject = (projectId?: string | null) => {
    if (!projectId) return
    const project = projects.find((item) => item.projectId === projectId)
    if (project) setSelectedMasterPlatformId(project.platformId)
    jumpToMasterTab('projects', project?.projectName ?? project?.projectCode ?? projectId)
  }

  const jumpToContract = (contractId?: string | null) => {
    if (!contractId) return
    const contract = contracts.find((item) => item.contractId === contractId)
    if (contract) setSelectedMasterPlatformId(contract.platformId)
    jumpToMasterTab('contracts', contract?.contractCode ?? contractId)
  }

  const jumpToProfile = (profileId?: string | null) => {
    if (!profileId) return
    const profile = profiles.find((item) => item.profileId === profileId)
    jumpToMasterTab('profiles', profile?.name ?? profileId)
  }

  const jumpToTemplate = (templateId?: string | null) => {
    if (!templateId) return
    const template = manualTemplates.find((item) => item.templateId === templateId)
    jumpToMasterTab('templates', template?.name ?? templateId)
  }

  const jumpToTerminal = (terminalId?: string | null) => {
    if (!terminalId) return
    setActiveKey('tcp-manual')
    setTerminalKeyword(terminalId)
  }

  const jumpToRelease = (releaseId?: string | null) => {
    if (!releaseId) return
    setActiveKey('tcp-manual')
    setReleaseKeyword(releaseId)
  }

  const focusedPlatforms = masterFocus?.tab === 'platforms'
    ? platforms.filter((item) => `${item.platformName} ${item.platformCode}`.toLowerCase().includes(masterFocus.keyword.toLowerCase()))
    : platforms
  const focusedTenants = masterFocus?.tab === 'tenants'
    ? platformScopedTenants.filter((item) => `${item.tenantName} ${item.tenantCode}`.toLowerCase().includes(masterFocus.keyword.toLowerCase()))
    : platformScopedTenants
  const focusedBrands = masterFocus?.tab === 'brands'
    ? platformScopedBrands.filter((item) => `${item.brandName} ${item.brandCode}`.toLowerCase().includes(masterFocus.keyword.toLowerCase()))
    : platformScopedBrands
  const focusedProjects = masterFocus?.tab === 'projects'
    ? platformScopedProjects.filter((item) => `${item.projectName} ${item.projectCode}`.toLowerCase().includes(masterFocus.keyword.toLowerCase()))
    : platformScopedProjects
  const focusedStores = masterFocus?.tab === 'stores'
    ? platformScopedStores.filter((item) => `${item.storeName} ${item.storeCode} ${item.unitCode} ${item.projectName ?? ''} ${item.brandName ?? ''}`.toLowerCase().includes(masterFocus.keyword.toLowerCase()))
    : platformScopedStores
  const focusedContracts = masterFocus?.tab === 'contracts'
    ? platformScopedContracts.filter((item) => `${item.contractCode} ${item.unitCode} ${item.storeName ?? ''} ${item.projectName ?? ''}`.toLowerCase().includes(masterFocus.keyword.toLowerCase()))
    : platformScopedContracts
  const focusedProfiles = masterFocus?.tab === 'profiles'
    ? profiles.filter((item) => `${item.name} ${item.profileCode}`.toLowerCase().includes(masterFocus.keyword.toLowerCase()))
    : profiles
  const focusedTemplates = masterFocus?.tab === 'templates'
    ? manualTemplates.filter((item) => `${item.name} ${item.templateCode} ${profiles.find((profile) => profile.profileId === item.profileId)?.name ?? ''}`.toLowerCase().includes(masterFocus.keyword.toLowerCase()))
    : manualTemplates

  const currentSandbox = runtimeContext?.currentSandbox ?? sandboxes.find((item) => item.isCurrent) ?? null
  const creatableSourceSandboxes = sandboxes.filter((item) => item.status === 'ACTIVE')
  const tcpBadge = String(taskReleases.length)
  const controlFocusItems = [
    terminalKeyword ? { label: '终端', value: terminalKeyword, clear: () => setTerminalKeyword('') } : null,
    activationCodeKeyword ? { label: '激活码', value: activationCodeKeyword, clear: () => setActivationCodeKeyword('') } : null,
    releaseKeyword ? { label: '发布单', value: releaseKeyword, clear: () => setReleaseKeyword('') } : null,
    taskKeyword ? { label: '任务实例', value: taskKeyword, clear: () => setTaskKeyword('') } : null,
  ].filter(Boolean) as Array<{ label: string; value: string; clear: () => void }>
  const masterTabs = [
    { key: 'platforms', label: '平台', count: platforms.length },
    { key: 'projects', label: '项目', count: platformScopedProjects.length },
    { key: 'tenants', label: '租户', count: platformScopedTenants.length },
    { key: 'brands', label: '品牌', count: platformScopedBrands.length },
    { key: 'stores', label: '门店', count: platformScopedStores.length },
    { key: 'contracts', label: '合同', count: platformScopedContracts.length },
    { key: 'profiles', label: '终端机型', count: profiles.length },
    { key: 'templates', label: '终端模板', count: manualTemplates.length },
  ] as const

  const topbarExtra = (
    <div className="topbar-sandbox">
      <div className="topbar-sandbox-meta">
        <span className="meta-label">当前沙箱</span>
        <strong>{currentSandbox?.name ?? '加载中...'}</strong>
      </div>
      <SelectInput
        label="切换沙箱"
        value={runtimeContext?.currentSandboxId ?? currentSandbox?.sandboxId ?? ''}
        onChange={(sandboxId) => {
          if (!sandboxId || sandboxId === runtimeContext?.currentSandboxId) return
          void runAction(async () => {
            resetSandboxScopedDetailState()
            const nextContext = await api.switchCurrentSandbox(sandboxId)
            api.setCurrentSandboxId(nextContext.currentSandboxId)
            setRuntimeContext(nextContext)
          }, `已切换到沙箱：${sandboxes.find((item) => item.sandboxId === sandboxId)?.name ?? sandboxId}`)
        }}
        options={sandboxes.map((item) => ({
          value: item.sandboxId,
          label: `${item.name}${item.isSystemDefault ? ' · 系统默认' : ''}${item.status !== 'ACTIVE' ? ` · ${item.status}` : ''}`,
          disabled: item.status !== 'ACTIVE',
        }))}
      />
      <ActionButton label="新建沙箱" tone="primary" onClick={() => setEditingSandboxId('create')} />
      <ActionButton label="管理沙箱" onClick={() => setEditingSandboxId(currentSandbox?.sandboxId ?? 'create')} />
    </div>
  )

  return (
    <AppShell
      title="Mock Terminal Platform"
      subtitle="面向 TCP / TDP 联调、场景演练与故障注入的高自由度后台控制台"
      sections={sections.map((section) => ({ ...section, badge: section.key === 'tcp' ? tcpBadge : undefined }))}
      activeKey={activeKey}
      onChange={(key) => setActiveKey(key as SectionKey)}
      topbarExtra={topbarExtra}
    >
      <Panel
        title="运行状态"
        subtitle="核心资源概览、告警和联调态势"
        actions={
          <div className="button-group">
            <ActionButton label="刷新数据" tone="primary" onClick={reloadAll} />
            <ActionButton label="预览导出数据" onClick={() => runAction(async () => setExportPayload(await api.exportAll()), '已加载导出数据')} />
            <ActionButton label="下载导出文件" onClick={downloadExportFile} />
          </div>
        }
      >
        {loading ? <div className="empty-state">正在加载平台数据…</div> : null}
        {error ? <div className="feedback error">{error}</div> : null}
        {message ? <div className="feedback success">{message}</div> : null}
        {overview ? (
          <div className="stat-grid">
            <StatCard label="终端总量" value={overview.terminalStats.total} />
            <StatCard label="在线终端" value={overview.terminalStats.online} tone="success" />
            <StatCard label="运行中任务" value={overview.taskStats.running} tone="warning" />
            <StatCard label="活跃会话" value={overview.sessionStats.connected} />
            <StatCard label="主题数量" value={overview.topicStats.total} />
            <StatCard label="故障命中" value={overview.faultStats.hits} tone="danger" />
          </div>
        ) : null}
      </Panel>

      {activeKey === 'overview' ? (
        <>
          <Panel title="当前沙箱" subtitle="当前全局上下文立即生效，所有模块都跟随该沙箱运行">
            <KeyValueList
              items={[
                { label: '名称', value: currentSandbox?.name ?? '--' },
                { label: '状态', value: currentSandbox ? <InlineBadge tone={currentSandbox.status === 'ACTIVE' ? 'success' : 'warning'}>{currentSandbox.status}</InlineBadge> : '--' },
                { label: '类型', value: currentSandbox?.isSystemDefault ? <InlineBadge tone="primary">系统默认</InlineBadge> : '普通沙箱' },
                { label: '用途', value: currentSandbox?.purpose ?? '--' },
                { label: '创建方式', value: currentSandbox?.creationMode ?? '--' },
                { label: '来源沙箱', value: currentSandbox?.sourceSandboxId ?? '--' },
                { label: '资源上限', value: JSON.stringify(currentSandbox?.resourceLimits ?? {}) },
                { label: '更新时间', value: formatTime(currentSandbox?.updatedAt) },
              ]}
            />
          </Panel>
          <Panel title="联调建议" subtitle="按典型联调路径组织的可操作入口">
            <KeyValueList
              items={[
                { label: '终端联调', value: `当前在线 ${onlineTerminals.length} 台，可直接下发配置 / 升级 / 远控任务` },
                { label: 'TDP 观察', value: `Projection ${projections.length} 条，Change Log ${changeLogs.length} 条` },
                { label: '测试场景', value: `${sceneTemplates.length} 个预制模板，可一键造数与投递` },
                { label: '故障调试', value: `${faultRules.length} 条规则，支持延迟 / 失败 / 伪结果回写` },
              ]}
            />
          </Panel>
          <Panel title="审计日志与导出预览" subtitle="后台操作、终端接入与调试动作的统一审计轨迹">
            <div className="two-column">
              <div>
                <DataTable
                  columns={['时间', '域', '动作', '操作者', '目标', '详情']}
                  rows={auditLogs.map((item) => [formatTime(item.createdAt ?? item.created_at), item.domain, item.action, item.operator, item.targetId ?? item.target_id ?? '--', JSON.stringify(item.detail)])}
                />
                <Pager page={auditPage} totalPages={auditTotalPages} onPrev={() => setAuditPage((value) => Math.max(1, value - 1))} onNext={() => setAuditPage((value) => Math.min(auditTotalPages, value + 1))} />
              </div>
              <JsonBlock value={exportPayload ?? { hint: '点击顶部“预览导出数据”查看结果' }} />
            </div>
          </Panel>
          <Panel title="模板库与导入" subtitle="复用 Topic / Fault 模板，并支持导入预检">
            <div className="three-column">
              <DataTable columns={['Topic 模板', '分类', 'Key', '套用']} rows={topicLibrary.map((item) => [item.name, item.category, item.key ?? '--', <ActionButton key={item.templateId} label="套用" onClick={() => applyTopicTemplate(item)} />])} />
              <DataTable columns={['Fault 模板', '分类', '目标类型', '套用']} rows={faultLibrary.map((item) => [item.name, item.category, item.targetType ?? '--', <ActionButton key={item.templateId} label="套用" onClick={() => applyFaultTemplate(item)} />])} />
              <JsonBlock value={importValidation ?? { hint: '可先执行导入预检' }} />
            </div>
            <FormGrid>
              <TextInput label="导入模板(JSON)" value={importJson} onChange={setImportJson} placeholder='{"topics":[],"faultRules":[]}' multiline minRows={8} />
            </FormGrid>
            <div className="button-group inline-actions">
              <ActionButton label="导入预检" onClick={() => runAction(async () => { if (!importJson.trim()) throw new Error('导入内容不能为空'); setImportValidation(await api.validateImportTemplates(JSON.parse(importJson))) }, '导入预检通过')} />
              <ActionButton label="导入模板" tone="primary" onClick={() => runAction(async () => { if (!importJson.trim()) throw new Error('导入内容不能为空'); await api.importTemplates(JSON.parse(importJson)) }, '模板导入成功')} />
            </div>
          </Panel>
        </>
      ) : null}

      {activeKey === 'tcp' || activeKey === 'tcp-quick' ? (
        <>
          {controlFocusItems.length ? (
            <Panel title="当前聚焦" subtitle="详情页跳转后的对象会自动带入控制面筛选，方便回到对应列表">
              <div className="button-group">
                {controlFocusItems.map((item) => (
                  <ActionButton key={`${item.label}-${item.value}`} label={`${item.label}: ${item.value}`} onClick={item.clear} />
                ))}
                <ActionButton
                  label="清空全部聚焦"
                  onClick={() => {
                    setTerminalKeyword('')
                    setActivationCodeKeyword('')
                    setReleaseKeyword('')
                    setTaskKeyword('')
                  }}
                />
              </div>
            </Panel>
          ) : null}

          <Panel
            title="TCP 控制台动作"
            subtitle="批量造终端、生成激活码、发布任务、强制改状态"
            actions={
              <div className="button-group">
                <ActionButton label="批量造 10 台终端" tone="primary" onClick={() => runAction(() => api.batchCreateTerminals(10), '已批量创建终端')} />
                <ActionButton label="生成 5 个激活码" onClick={() => runAction(() => api.batchCreateActivationCodes(5), '已生成激活码')} />
                <ActionButton
                  label="发布配置任务"
                  onClick={() =>
                    runAction(
                      () =>
                        api.createTaskRelease({
                          title: '控制台-配置下发',
                          taskType: 'CONFIG_PUBLISH',
                          sourceType: 'CONFIG',
                          sourceId: 'config-2026.04.06',
                          priority: 70,
                          targetTerminalIds: quickActionTerminals.slice(0, 3).map((item) => item.terminalId),
                          payload: { configVersion: 'config-2026.04.06', mode: 'delta' },
                        }),
                      '已创建并投递配置任务',
                    )
                  }
                />
                <ActionButton label="首台终端置为告警" tone="danger" onClick={() => (quickActionTerminals[0] ? runAction(() => api.forceTerminalStatus(quickActionTerminals[0].terminalId, { healthStatus: 'WARNING', presenceStatus: 'ONLINE' }), '已强制修改终端状态') : Promise.resolve())} />
              </div>
            }
          >
            <KeyValueList items={[{ label: '终端', value: `${terminals.length} 台` }, { label: '激活码', value: `${activationCodes.length} 个` }, { label: '任务发布', value: `${taskReleases.length} 个` }, { label: '任务实例', value: `${taskInstances.length} 个` }]} />
          </Panel>

          <Panel title="激活实操流" subtitle="生成激活码后，直接模拟真实终端激活流程">
            <FormGrid>
              <TextInput label="激活码" value={activationCodeInput} onChange={setActivationCodeInput} placeholder="输入 12 位数字激活码" />
              <TextInput label="设备指纹" value="mock-fingerprint-rn84" readOnly onChange={() => undefined} />
            </FormGrid>
            {!activationCodeInputValid ? <div className="feedback error">激活码格式不正确，请输入 12 位纯数字。</div> : null}
            <div className="button-group inline-actions">
              <ActionButton label="执行终端激活" tone="primary" onClick={() => runAction(async () => { if (!activationCodeInput.trim()) throw new Error('激活码不能为空'); if (!isNumericActivationCode(activationCodeInput)) throw new Error('激活码必须是 12 位纯数字'); await api.activateTerminal({ activationCode: activationCodeInput, deviceFingerprint: 'mock-fingerprint-rn84', deviceInfo: { model: 'Mock-POS-X1', osVersion: 'Android 14', manufacturer: 'IMPOS2' } }) }, '终端激活成功')} />
            </div>
          </Panel>

          <Panel title="终端总览" subtitle="支持关键字筛选、状态观察、快照与变更对比">
            <FormGrid columns={3}>
              <TextInput label="终端筛选" value={terminalKeyword} onChange={setTerminalKeyword} placeholder="终端 ID / 门店 / 健康 / 生命周期 / 在线状态" />
            </FormGrid>
            {emptyTerminals ? <div className="empty-state inline-actions">当前筛选条件下没有终端，试试清空筛选词。</div> : null}
            <div className="three-column inline-actions">
              <DataTable columns={['终端 ID', '门店', '生命周期', '在线状态', '健康状态', 'App 版本', '详情']} rows={filteredTerminals.slice(0, 12).map((item) => [item.terminalId, item.storeId, item.lifecycleStatus, item.presenceStatus, item.healthStatus, item.currentAppVersion ?? '--', <ActionButton key={item.terminalId} label="查看" onClick={() => openDetail(`终端 ${item.terminalId}`, buildTerminalDetail(item.terminalId) ?? item)} />])} />
              <JsonBlock value={filteredTerminals[0] ?? { hint: '暂无终端' }} />
              <JsonBlock value={{ snapshot: terminalSnapshot ?? [], changes: terminalChanges ?? [], compareHint: '左侧为终端基础信息，右侧为 TDP 快照与变更链路' }} />
            </div>
          </Panel>

          <Panel title="激活码与任务发布" subtitle="联调常用入口与下发上下文">
            <FormGrid columns={2}>
              <TextInput label="激活码筛选" value={activationCodeKeyword} onChange={setActivationCodeKeyword} placeholder="激活码 / 门店 / 项目 / 状态 / 已绑定终端" />
              <TextInput label="发布单筛选" value={releaseKeyword} onChange={setReleaseKeyword} placeholder="发布单 ID / 标题 / 类型 / 状态 / 来源" />
            </FormGrid>
            {emptyActivationCodes ? <div className="empty-state inline-actions">当前筛选条件下没有激活码，试试清空筛选词。</div> : null}
            {emptyReleases ? <div className="empty-state inline-actions">当前筛选条件下没有发布单，试试清空筛选词。</div> : null}
            <div className="two-column">
              <DataTable columns={['激活码', '门店', '状态', '已绑定终端', '详情']} rows={filteredActivationCodes.slice(0, 8).map((item) => [<code key={`${item.code}-value`} className="code-chip">{item.code}</code>, item.storeId, item.status, item.usedBy ?? '--', <div key={item.code} className="button-group"><ActionButton label="查看" onClick={() => openDetail(`激活码 ${item.code}`, buildActivationCodeDetail(item.code) ?? item)} /><ActionButton label="看门店" onClick={() => jumpToStore(item.storeId)} />{item.usedBy ? <ActionButton label="看终端" onClick={() => jumpToTerminal(item.usedBy)} /> : null}</div>])} />
              <DataTable columns={['发布单', '类型', '状态', '优先级', '目标', '详情']} rows={filteredTaskReleases.slice(0, 8).map((item) => [item.title, item.taskType, item.status, item.priority, JSON.stringify(item.targetSelector), <div key={item.releaseId} className="button-group"><ActionButton label="查看" onClick={() => openDetail(`发布单 ${item.title}`, buildTaskReleaseDetail(item.releaseId) ?? item)} /><ActionButton label="看实例" onClick={() => jumpToRelease(item.releaseId)} /></div>])} />
            </div>
          </Panel>

          <Panel title="任务实例调试与链路追踪" subtitle="支持筛选、伪结果回报，并查看 TCP → TDP 的完整链路" actions={selectedInstance ? <ActionButton label="给首个实例写入成功结果" onClick={() => runAction(() => api.mockTaskResult(selectedInstance.instanceId, { status: 'SUCCESS', result: { message: 'mock ack', finishedBy: 'admin' } }), '已写入伪结果')} /> : undefined}>
            <FormGrid columns={3}>
              <TextInput label="任务筛选" value={taskKeyword} onChange={setTaskKeyword} placeholder="实例 ID / 终端 / 类型 / 状态 / 投递状态" />
            </FormGrid>
            {emptyTasks ? <div className="empty-state inline-actions">当前筛选条件下没有任务实例，试试清空筛选词。</div> : null}
            <div className="three-column inline-actions">
              <DataTable columns={['实例 ID', '终端', '任务类型', '状态', '投递状态', '更新时间', '详情']} rows={filteredTaskInstances.slice(0, 8).map((item) => [item.instanceId, item.terminalId, item.taskType, item.status, item.deliveryStatus, formatTime(item.updatedAt), <div key={item.instanceId} className="button-group"><ActionButton label="查看" onClick={() => openDetail(`任务实例 ${item.instanceId}`, buildTaskInstanceDetail(item.instanceId) ?? item)} /><ActionButton label="看终端" onClick={() => jumpToTerminal(item.terminalId)} /></div>])} />
              <JsonBlock value={selectedInstance ?? { hint: '暂无实例数据' }} />
              <JsonBlock value={taskTrace ?? { hint: '暂无链路追踪数据' }} />
            </div>
          </Panel>
        </>
      ) : null}

      {activeKey === 'tcp-manual' ? (
        <>
          {controlFocusItems.length ? (
            <Panel title="当前聚焦" subtitle="详情页跳转后会把对象关键字带到手动控制台，便于继续操作">
              <div className="button-group">
                {controlFocusItems.map((item) => (
                  <ActionButton key={`${item.label}-${item.value}`} label={`${item.label}: ${item.value}`} onClick={item.clear} />
                ))}
                <ActionButton
                  label="清空全部聚焦"
                  onClick={() => {
                    setTerminalKeyword('')
                    setActivationCodeKeyword('')
                    setReleaseKeyword('')
                    setTaskKeyword('')
                  }}
                />
              </div>
            </Panel>
          ) : null}

          <Panel title="手动控制台概览" subtitle="按对象和业务流拆开控制面，适合逐步理解、调试和验证">
            <div className="stat-grid manual-stat-grid">
              <StatCard label="终端机型" value={profiles.length} />
              <StatCard label="终端模板" value={manualTemplates.length} />
              <StatCard label="激活码池" value={activationCodes.length} />
              <StatCard label="终端实例" value={terminals.length} tone="success" />
              <StatCard label="任务发布单" value={taskReleases.length} />
              <StatCard label="任务实例" value={taskInstances.length} tone="warning" />
              <StatCard label="在线会话" value={sessions.length} />
            </div>
          </Panel>

          <Panel
            title="当前对象工作台"
            subtitle="把当前筛选结果中的关键对象串起来，方便从一个对象继续推进到下一个业务动作"
            actions={
              <div className="button-group">
                {selectedActivationCode ? <ActionButton label="查看激活码" onClick={() => openDetail(`激活码 ${selectedActivationCode.code}`, buildActivationCodeDetail(selectedActivationCode.code) ?? selectedActivationCode)} /> : null}
                {selectedTerminal ? <ActionButton label="查看终端" onClick={() => openDetail(`终端 ${selectedTerminal.terminalId}`, buildTerminalDetail(selectedTerminal.terminalId) ?? selectedTerminal)} /> : null}
                {selectedRelease ? <ActionButton label="查看发布单" onClick={() => openDetail(`发布单 ${selectedRelease.title}`, buildTaskReleaseDetail(selectedRelease.releaseId) ?? selectedRelease)} /> : null}
                {selectedInstance ? <ActionButton label="查看实例" onClick={() => openDetail(`任务实例 ${selectedInstance.instanceId}`, buildTaskInstanceDetail(selectedInstance.instanceId) ?? selectedInstance)} /> : null}
              </div>
            }
          >
            <div className="two-column">
              <KeyValueList
                items={[
                  { label: '当前激活码', value: selectedActivationCode ? `${selectedActivationCode.code} / ${selectedActivationCode.status}` : '--' },
                  { label: '激活码门店', value: selectedActivationCode ? stores.find((item) => item.storeId === selectedActivationCode.storeId)?.storeName ?? selectedActivationCode.storeId : '--' },
                  { label: '当前终端', value: selectedTerminal ? `${selectedTerminal.terminalId} / ${selectedTerminal.healthStatus}` : '--' },
                  { label: '终端门店', value: selectedTerminal ? stores.find((item) => item.storeId === selectedTerminal.storeId)?.storeName ?? selectedTerminal.storeId : '--' },
                  { label: '当前发布单', value: selectedRelease ? `${selectedRelease.title} / ${selectedRelease.status}` : '--' },
                  { label: '发布类型', value: selectedRelease?.taskType ?? '--' },
                  { label: '当前任务实例', value: selectedInstance ? `${selectedInstance.instanceId} / ${selectedInstance.status}` : '--' },
                  { label: '实例投递', value: selectedInstance?.deliveryStatus ?? '--' },
                ]}
              />
              <JsonBlock
                value={{
                  activationCode: selectedActivationCode
                    ? {
                        code: selectedActivationCode.code,
                        storeId: selectedActivationCode.storeId,
                        profileId: selectedActivationCode.profileId,
                        templateId: selectedActivationCode.templateId,
                        usedBy: selectedActivationCode.usedBy,
                      }
                    : null,
                  terminal: selectedTerminal
                    ? {
                        terminalId: selectedTerminal.terminalId,
                        storeId: selectedTerminal.storeId,
                        projectId: selectedTerminal.projectId,
                        profileId: selectedTerminal.profileId,
                        templateId: selectedTerminal.templateId,
                      }
                    : null,
                  release: selectedRelease
                    ? {
                        releaseId: selectedRelease.releaseId,
                        taskType: selectedRelease.taskType,
                        sourceId: selectedRelease.sourceId,
                        targetSelector: selectedRelease.targetSelector,
                      }
                    : null,
                  instance: selectedInstance
                    ? {
                        instanceId: selectedInstance.instanceId,
                        releaseId: selectedInstance.releaseId,
                        terminalId: selectedInstance.terminalId,
                        deliveryStatus: selectedInstance.deliveryStatus,
                      }
                    : null,
                }}
              />
            </div>
            <div className="button-group inline-actions">
              {selectedActivationCode ? <ActionButton label="带入手动激活" onClick={() => setManualActivationCode(selectedActivationCode.code)} /> : null}
              {selectedActivationCode ? <ActionButton label="查看激活门店" onClick={() => jumpToStore(selectedActivationCode.storeId)} /> : null}
              {selectedActivationCode?.usedBy ? <ActionButton label="查看绑定终端" onClick={() => jumpToTerminal(selectedActivationCode.usedBy)} /> : null}
              {selectedTerminal ? <ActionButton label="带入目标终端" onClick={() => setManualTargetTerminalIds(selectedTerminal.terminalId)} /> : null}
              {selectedTerminal ? <ActionButton label="查看终端门店" onClick={() => jumpToStore(selectedTerminal.storeId)} /> : null}
              {selectedTerminal?.profileId ? <ActionButton label="查看终端机型" onClick={() => jumpToProfile(selectedTerminal.profileId)} /> : null}
              {selectedTerminal?.templateId ? <ActionButton label="查看终端模板" onClick={() => jumpToTemplate(selectedTerminal.templateId)} /> : null}
              {selectedRelease ? <ActionButton label="聚焦相关实例" onClick={() => setTaskKeyword(selectedRelease.releaseId)} /> : null}
              {selectedRelease ? <ActionButton label="查看发布终端" onClick={() => jumpToTerminal(taskInstances.find((item) => item.releaseId === selectedRelease.releaseId)?.terminalId)} /> : null}
              {selectedInstance ? <ActionButton label="写入成功结果" onClick={() => runAction(() => api.mockTaskResult(selectedInstance.instanceId, { status: 'SUCCESS', result: { message: 'manual-workbench success', finishedBy: 'manual-workbench' } }), `已写入实例 ${selectedInstance.instanceId} 结果`)} /> : null}
              {selectedInstance ? <ActionButton label="查看实例终端" onClick={() => jumpToTerminal(selectedInstance.terminalId)} /> : null}
              {selectedInstance ? <ActionButton label="查看实例发布单" onClick={() => jumpToRelease(selectedInstance.releaseId)} /> : null}
            </div>
          </Panel>

          <Panel title="对象使用路径" subtitle="主数据统一在基础资料维护，手动控制台只负责消费这些对象完成激活、造终端和发任务">
            <div className="three-column">
              <DataTable
                columns={['对象', '数量', '说明']}
                rows={[
                  ['终端机型', profiles.length, '由基础资料统一维护，手动控制台仅引用'],
                  ['终端模板', manualTemplates.length, '由基础资料统一维护，手动控制台仅引用'],
                  ['激活码', activationCodes.length, '绑定门店、项目、模板，驱动真实激活流程'],
                  ['终端实例', terminals.length, '观察生命周期、在线状态和 TDP 快照'],
                  ['任务发布', taskReleases.length, '对象化任务单，不再只走顶部批量按钮'],
                  ['任务实例', taskInstances.length, '逐终端回看投递、执行和结果'],
                ]}
              />
              <JsonBlock
                value={{
                  nextActions: [
                    '先在基础资料维护租户 / 品牌 / 项目 / 门店 / 终端机型 / 终端模板',
                    '然后生成激活码或直接创建终端',
                    '最后创建发布单并跟踪任务实例',
                  ],
                }}
              />
              <KeyValueList
                items={[
                  { label: '当前项目数', value: `${projects.length}` },
                  { label: '当前门店数', value: `${stores.length}` },
                  { label: '当前终端机型数', value: `${profiles.length}` },
                  { label: '当前终端模板数', value: `${manualTemplates.length}` },
                  { label: '首个项目', value: projects[0]?.projectName ?? '--' },
                  { label: '首个门店', value: stores[0]?.storeName ?? '--' }
                ]}
              />
            </div>
          </Panel>

          <Panel title="终端模型引用" subtitle="这里仅查看终端机型和终端模板的引用情况；如需新增或编辑，请前往基础资料">
            <div className="two-column">
              <div>
                <DataTable
                  columns={['机型编码', '机型名称', '模板数', '终端数', '操作']}
                  rows={profiles.map((item) => [
                    item.profileCode,
                    item.name,
                    item.templateCount ?? 0,
                    item.terminalCount ?? 0,
                    <div key={item.profileId} className="button-group">
                      <ActionButton label="查看" onClick={() => openDetail(`终端机型 ${item.name}`, buildProfileDetail(item.profileId) ?? item)} />
                      <ActionButton label="去基础资料" onClick={() => jumpToMasterTab('profiles', item.name)} />
                    </div>,
                  ])}
                />
                <div className="inline-actions">
                  <div className="feedback">
                    终端机型由“基础资料 → 终端机型”统一维护。这里仅用于查看当前有哪些机型可供激活码和终端引用。
                  </div>
                  <ActionButton label="去基础资料维护终端机型" onClick={() => jumpToMasterTab('profiles', '')} />
                </div>
              </div>
              <div>
                <DataTable
                  columns={['模板编码', '模板名称', '适用机型', '激活码数', '终端数', '操作']}
                  rows={manualTemplates.map((item) => [
                    item.templateCode,
                    item.name,
                    profiles.find((profile) => profile.profileId === item.profileId)?.name ?? item.profileId,
                    item.activationCodeCount ?? 0,
                    item.terminalCount ?? 0,
                    <div key={item.templateId} className="button-group">
                      <ActionButton label="查看" onClick={() => openDetail(`终端模板 ${item.name}`, buildTemplateDetail(item.templateId) ?? item)} />
                      <ActionButton label="去基础资料" onClick={() => jumpToMasterTab('templates', item.name)} />
                    </div>,
                  ])}
                />
                <div className="inline-actions">
                  <div className="feedback">
                    终端模板由“基础资料 → 终端模板”统一维护。手动控制台只负责选择模板来生成激活码、激活终端和验证流程。
                  </div>
                  <ActionButton label="去基础资料维护终端模板" onClick={() => jumpToMasterTab('templates', '')} />
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="激活管理与终端实例" subtitle="按对象拆开后，可以从激活码池推进到终端实例，而不是只看一块混合面板">
            <FormGrid columns={2}>
              <TextInput label="激活码筛选" value={activationCodeKeyword} onChange={setActivationCodeKeyword} placeholder="激活码 / 门店 / 项目 / 状态 / 已绑定终端" />
              <TextInput label="终端筛选" value={terminalKeyword} onChange={setTerminalKeyword} placeholder="终端 ID / 门店 / 健康 / 生命周期 / 在线状态" />
            </FormGrid>
            {emptyActivationCodes ? <div className="empty-state inline-actions">当前筛选条件下没有激活码，试试清空筛选词。</div> : null}
            {emptyTerminals ? <div className="empty-state inline-actions">当前筛选条件下没有终端，试试清空筛选词。</div> : null}
            <div className="two-column">
              <DataTable
                columns={['激活码', '项目', '门店', '状态', 'Template', '详情']}
                rows={filteredActivationCodes.slice(0, 12).map((item) => [
                  <code key={`${item.code}-value`} className="code-chip">{item.code}</code>,
                  projects.find((project) => project.projectId === item.projectId)?.projectName ?? item.projectId ?? '--',
                  stores.find((store) => store.storeId === item.storeId)?.storeName ?? item.storeId,
                  item.status,
                  manualTemplates.find((template) => template.templateId === item.templateId)?.name ?? item.templateId ?? '--',
                  <div key={item.code} className="button-group"><ActionButton label="查看" onClick={() => openDetail(`激活码 ${item.code}`, buildActivationCodeDetail(item.code) ?? item)} /><ActionButton label="看门店" onClick={() => jumpToStore(item.storeId)} />{item.usedBy ? <ActionButton label="看终端" onClick={() => jumpToTerminal(item.usedBy)} /> : null}</div>,
                ])}
              />
              <DataTable
                columns={['终端', '项目', '门店', '生命周期', '在线状态', '健康状态', '详情']}
                rows={filteredTerminals.slice(0, 12).map((item) => [
                  item.terminalId,
                  projects.find((project) => project.projectId === item.projectId)?.projectName ?? item.projectId ?? '--',
                  stores.find((store) => store.storeId === item.storeId)?.storeName ?? item.storeId,
                  item.lifecycleStatus,
                  item.presenceStatus,
                  item.healthStatus,
                  <div key={item.terminalId} className="button-group"><ActionButton label="查看" onClick={() => openDetail(`终端 ${item.terminalId}`, buildTerminalDetail(item.terminalId) ?? item)} /><ActionButton label="看门店" onClick={() => jumpToStore(item.storeId)} />{item.profileId ? <ActionButton label="看 Profile" onClick={() => jumpToProfile(item.profileId)} /> : null}</div>,
                ])}
              />
            </div>
            <div className="two-column inline-actions">
              <Panel title="手动生成激活码" subtitle="明确指定门店、Profile、Template，按对象推进激活池">
                <FormGrid columns={3}>
                  <SelectInput label="门店" value={manualActivationStoreId} onChange={setManualActivationStoreId} options={stores.map((item) => ({ label: `${item.storeName} (${item.projectName ?? item.projectId})`, value: item.storeId }))} />
                  <SelectInput label="Profile" value={manualActivationProfileId} onChange={setManualActivationProfileId} options={profiles.map((item) => ({ label: item.name, value: item.profileId }))} />
                  <SelectInput label="Template" value={manualActivationTemplateId} onChange={setManualActivationTemplateId} options={manualTemplates.map((item) => ({ label: item.name, value: item.templateId }))} />
                  <TextInput label="数量" value={manualActivationCount} onChange={setManualActivationCount} placeholder="如 3" />
                  <ActionButton
                    label="生成激活码"
                    tone="primary"
                    onClick={() =>
                      runAction(async () => {
                        if (!manualActivationStoreId) throw new Error('请选择门店')
                        const count = Number(manualActivationCount)
                        if (!Number.isFinite(count) || count <= 0) throw new Error('数量必须大于 0')
                        await api.batchCreateActivationCodes({
                          count,
                          storeId: manualActivationStoreId,
                          profileId: manualActivationProfileId || undefined,
                          templateId: manualActivationTemplateId || undefined,
                        })
                      }, '已生成手动激活码')
                    }
                  />
                </FormGrid>
              </Panel>

              <Panel title="手动终端激活" subtitle="输入指定激活码后，立即创建真实终端实例">
                <FormGrid columns={3}>
                  <TextInput label="激活码" value={manualActivationCode} onChange={setManualActivationCode} placeholder="如 123456789012" />
                  <TextInput label="设备指纹" value={manualDeviceFingerprint} onChange={setManualDeviceFingerprint} placeholder="输入设备指纹" />
                  <ActionButton
                    label="执行激活"
                    tone="primary"
                    onClick={() =>
                      runAction(async () => {
                        if (!manualActivationCode.trim()) throw new Error('请输入激活码')
                        if (!isNumericActivationCode(manualActivationCode)) throw new Error('激活码必须是 12 位纯数字')
                        if (!manualDeviceFingerprint.trim()) throw new Error('请输入设备指纹')
                        await api.activateTerminal({
                          activationCode: manualActivationCode,
                          deviceFingerprint: manualDeviceFingerprint,
                          deviceInfo: { model: 'Manual-POS', osVersion: 'Android 14', manufacturer: 'IMPOS2', source: 'manual-console' },
                        })
                      }, '已完成手动激活')
                    }
                  />
                </FormGrid>
                {!manualActivationCodeValid ? <div className="feedback error">激活码格式不正确，请输入 12 位纯数字。</div> : null}
              </Panel>
            </div>
            <div className="inline-actions">
              <Panel title="终端实例维护" subtitle="针对单台终端手动调整在线态和健康态，便于验证异常流">
                <DataTable
                  columns={['终端', '门店', '在线态', '健康态', '操作']}
                  rows={filteredTerminals.slice(0, 6).map((item) => [
                    item.terminalId,
                    stores.find((store) => store.storeId === item.storeId)?.storeName ?? item.storeId,
                    item.presenceStatus,
                    item.healthStatus,
                    <div key={item.terminalId} className="button-group">
                      <ActionButton label="设为在线" onClick={() => runAction(() => api.forceTerminalStatus(item.terminalId, { presenceStatus: 'ONLINE', healthStatus: item.healthStatus }), `已更新终端 ${item.terminalId}`)} />
                      <ActionButton label="设为告警" tone="danger" onClick={() => runAction(() => api.forceTerminalStatus(item.terminalId, { presenceStatus: item.presenceStatus, healthStatus: 'WARNING' }), `已更新终端 ${item.terminalId}`)} />
                    </div>,
                  ])}
                />
              </Panel>
            </div>
          </Panel>

          <Panel title="任务发布与链路追踪" subtitle="将发布单、实例、链路拆开呈现，便于单步调试控制面与数据面">
            <FormGrid columns={2}>
              <TextInput label="发布单筛选" value={releaseKeyword} onChange={setReleaseKeyword} placeholder="发布单 ID / 标题 / 类型 / 状态 / 来源" />
              <TextInput label="任务实例筛选" value={taskKeyword} onChange={setTaskKeyword} placeholder="实例 ID / 发布单 / 终端 / 类型 / 状态 / 投递状态" />
            </FormGrid>
            {emptyReleases ? <div className="empty-state inline-actions">当前筛选条件下没有发布单，试试清空筛选词。</div> : null}
            {emptyTasks ? <div className="empty-state inline-actions">当前筛选条件下没有任务实例，试试清空筛选词。</div> : null}
            <div className="three-column">
              <DataTable
                columns={['发布单', '任务类型', '来源', '状态', '优先级', '详情']}
                rows={filteredTaskReleases.slice(0, 10).map((item) => [
                  item.title,
                  item.taskType,
                  item.sourceType,
                  item.status,
                  item.priority,
                  <div key={item.releaseId} className="button-group"><ActionButton label="查看" onClick={() => openDetail(`发布单 ${item.title}`, buildTaskReleaseDetail(item.releaseId) ?? item)} /><ActionButton label="看实例" onClick={() => setTaskKeyword(item.releaseId)} /></div>,
                ])}
              />
              <DataTable
                columns={['实例', '终端', '状态', '投递', '更新时间', '详情']}
                rows={filteredTaskInstances.slice(0, 10).map((item) => [
                  item.instanceId,
                  item.terminalId,
                  item.status,
                  item.deliveryStatus,
                  formatTime(item.updatedAt),
                  <div key={item.instanceId} className="button-group"><ActionButton label="查看" onClick={() => openDetail(`任务实例 ${item.instanceId}`, buildTaskInstanceDetail(item.instanceId) ?? item)} /><ActionButton label="看终端" onClick={() => jumpToTerminal(item.terminalId)} /><ActionButton label="看发布单" onClick={() => jumpToRelease(item.releaseId)} /></div>,
                ])}
              />
              <JsonBlock value={taskTrace ?? { hint: '在左侧快捷控制台创建任务后，这里会持续显示首个实例的链路' }} />
            </div>
            <div className="inline-actions">
              <Panel title="手动创建发布单" subtitle="按指定终端逐台下发，替代原来的批量快捷按钮">
                <FormGrid columns={3}>
                  <TextInput label="发布标题" value={manualTaskTitle} onChange={setManualTaskTitle} placeholder="输入发布标题" />
                  <SelectInput
                    label="任务类型"
                    value={manualTaskType}
                    onChange={(value) => setManualTaskType(value as 'CONFIG_PUBLISH' | 'APP_UPGRADE' | 'REMOTE_CONTROL')}
                    options={[
                      { label: '配置下发', value: 'CONFIG_PUBLISH' },
                      { label: '应用升级', value: 'APP_UPGRADE' },
                      { label: '远程控制', value: 'REMOTE_CONTROL' },
                    ]}
                  />
                  <TextInput label="来源 ID" value={manualTaskSourceId} onChange={setManualTaskSourceId} placeholder="如 config-2026.04.07" />
                  <TextInput label="目标终端(ID,逗号分隔)" value={manualTargetTerminalIds} onChange={setManualTargetTerminalIds} placeholder="如 T-1001,T-1002" />
                  <TextInput label="Payload(JSON)" value={manualTaskPayload} onChange={setManualTaskPayload} multiline minRows={6} placeholder='{"configVersion":"config-manual-001"}' />
                  <ActionButton
                    label="创建并下发"
                    tone="primary"
                    onClick={() =>
                      runAction(async () => {
                        const terminalIds = manualTargetTerminalIds
                          .split(',')
                          .map((item) => item.trim())
                          .filter(Boolean)
                        if (!manualTaskTitle.trim()) throw new Error('请输入发布标题')
                        if (terminalIds.length === 0) throw new Error('至少指定一个目标终端')
                        await api.createTaskRelease({
                          title: manualTaskTitle,
                          taskType: manualTaskType,
                          sourceType: manualTaskType === 'APP_UPGRADE' ? 'APP' : manualTaskType === 'REMOTE_CONTROL' ? 'CONTROL' : 'CONFIG',
                          sourceId: manualTaskSourceId,
                          priority: 70,
                          targetTerminalIds: terminalIds,
                          payload: JSON.parse(manualTaskPayload),
                        })
                      }, '已创建手动发布单')
                    }
                  />
                </FormGrid>
              </Panel>
            </div>
          </Panel>
        </>
      ) : null}

      {activeKey === 'tdp' ? (
        <>
          <TdpPolicyCenter terminals={terminals} onMutated={reloadAll} />

          <Panel title="TDP Topic / Schema / Scope 治理" subtitle="允许注册 Topic 后自由扩展 Payload，并支持 Projection 注入">
            <FormGrid>
              <TextInput label="Topic Key" value={topicKey} onChange={setTopicKey} placeholder="如 terminal.runtime.config" />
              <TextInput label="Topic 名称" value={topicName} onChange={setTopicName} placeholder="输入主题名称" />
              <TextInput label="Scope 类型" value={topicScope} onChange={setTopicScope} placeholder="TERMINAL / STORE / TENANT" />
              <TextInput label="Projection Payload(JSON)" value={projectionPayload} onChange={setProjectionPayload} placeholder='{"foo":"bar"}' multiline minRows={6} />
            </FormGrid>
            <div className="button-group inline-actions">
              <ActionButton label="注册 Topic" tone="primary" onClick={() => runAction(async () => { if (!topicKey.trim() || !topicName.trim()) throw new Error('Topic Key 和 Topic 名称不能为空'); await api.createTopic({ key: topicKey, name: topicName, payloadMode: 'FLEXIBLE_JSON', scopeType: topicScope, schema: { type: 'object', additionalProperties: true }, retentionHours: 72 }) }, '已创建 Topic')} />
              <ActionButton label="注入 Projection" onClick={() => runAction(() => api.upsertProjection({ topicKey, scopeType: topicScope, scopeKey: filteredTerminals[0]?.terminalId ?? 'T-1001', payload: JSON.parse(projectionPayload) }), '已写入 Projection')} />
            </div>
          </Panel>

          <Panel title="Session 实操" subtitle="手工模拟终端连接、心跳与断开，便于联调 TDP 生命周期">
            <FormGrid columns={3}>
              <TextInput label="终端 ID" value={sessionTerminalId} onChange={setSessionTerminalId} placeholder="如 T-1001" />
            </FormGrid>
            <div className="button-group inline-actions">
              <ActionButton label="建立 Session" tone="primary" onClick={() => runAction(() => api.connectSession({ terminalId: sessionTerminalId, clientVersion: '2.4.0-dev', protocolVersion: 'tdp-1.0' }), '已建立 Session')} />
              {selectedSession ? <ActionButton label="发送心跳" onClick={() => runAction(() => api.heartbeatSession(selectedSession.sessionId), '已发送心跳')} /> : null}
              {selectedSession ? <ActionButton label="断开首个 Session" tone="danger" onClick={() => runAction(() => api.disconnectSession(selectedSession.sessionId), '已断开 Session')} /> : null}
            </div>
          </Panel>

          <Panel title="TDP 会话与主题" subtitle="连接态、协议版本、Topic 基础治理">
            <div className="two-column">
              <DataTable columns={['Session', '终端', '状态', '客户端版本', '协议版本', '最近心跳', 'Delivered/Acked/Applied', 'HighWatermark', 'AckLag/ApplyLag', '详情']} rows={sessions.slice(0, 8).map((item) => [item.sessionId, item.terminalId, item.status, item.clientVersion, item.protocolVersion, formatTime(item.lastHeartbeatAt), `${item.lastDeliveredRevision ?? '--'} / ${item.lastAckedRevision ?? '--'} / ${item.lastAppliedRevision ?? '--'}`, item.highWatermark ?? '--', `${item.ackLag ?? '--'} / ${item.applyLag ?? '--'}`, <div key={item.sessionId} className="button-group"><ActionButton label="查看" onClick={() => openDetail(`Session ${item.sessionId}`, item)} /><ActionButton label="降级" onClick={() => runAction(() => api.sendEdgeDegraded(item.sessionId, { reason: 'maintenance_mode', nodeState: 'grace', gracePeriodSeconds: 300, alternativeEndpoints: [] }), `已向 ${item.sessionId} 发送 EDGE_DEGRADED`)} /><ActionButton label="迁移" tone="danger" onClick={() => runAction(() => api.sendSessionRehome(item.sessionId, { reason: 'node_draining', deadline: new Date(Date.now() + 60_000).toISOString(), alternativeEndpoints: [] }), `已向 ${item.sessionId} 发送 SESSION_REHOME_REQUIRED`)} /></div>])} />
              <DataTable columns={['Topic Key', '名称', 'Payload 模式', 'Scope', '保留时长', '详情']} rows={topics.slice(0, 10).map((item) => [item.key, item.name, item.payloadMode, item.scopeType, `${item.retentionHours}h`, <ActionButton key={item.key} label="查看" onClick={() => openDetail(`Topic ${item.key}`, item)} />])} />
            </div>
          </Panel>

          <Panel title="Scope 统计 / Projection / Change Log" subtitle="Revision、快照和变更链路观察">
            <div className="three-column">
              <DataTable columns={['Topic', 'Scope', 'Topic 数量']} rows={(scopeStats?.topicScopes ?? []).slice(0, 10).map((item) => [item.topic_key, item.scope_type, item.topic_count])} />
              <DataTable columns={['Topic', 'Scope', 'Key', 'Revision', '更新时间', '详情']} rows={projections.slice(0, 10).map((item) => [item.topicKey, item.scopeType, item.scopeKey, item.revision, formatTime(item.updatedAt), <ActionButton key={`${item.topicKey}-${item.scopeKey}-${item.revision}`} label="查看" onClick={() => openDetail(`Projection ${item.topicKey}:${item.scopeKey}`, item)} />])} />
              <DataTable columns={['Change', 'Topic', 'Revision', '来源发布单', '时间', '详情']} rows={changeLogs.slice(0, 10).map((item) => [item.changeId, item.topicKey, item.revision, item.sourceReleaseId ?? '--', formatTime(item.createdAt), <ActionButton key={item.changeId} label="查看" onClick={() => openDetail(`Change ${item.changeId}`, item)} />])} />
            </div>
          </Panel>

          <Panel title="Command Outbox" subtitle="`remote.control / print.command` 这类点对点命令单独投递，不进入 Projection / Change Log">
            <DataTable columns={['Command', '终端', 'Topic', '状态', '来源发布单', 'Delivered', 'Acked', '详情']} rows={commandOutbox.slice(0, 10).map((item) => [item.commandId, item.terminalId, item.topicKey, item.status, item.sourceReleaseId ?? '--', formatTime(item.deliveredAt), formatTime(item.ackedAt), <ActionButton key={item.commandId} label="查看" onClick={() => openDetail(`Command ${item.commandId}`, item)} />])} />
          </Panel>

          <Panel title="当前选中快照" subtitle="便于核对 TCP 委托后的 TDP 投递上下文">
            <div className="two-column">
              <JsonBlock value={selectedProjection ?? { hint: '暂无 projection' }} />
              <JsonBlock value={selectedChangeLog ?? { hint: '暂无 change log' }} />
            </div>
          </Panel>
        </>
      ) : null}

      {activeKey === 'hot-update' ? (
        <HotUpdateCenter terminals={terminals} onMutated={reloadAll} />
      ) : null}

      {activeKey === 'scene' ? (
        <>
          <Panel title="场景模板库" subtitle="按类别沉淀可复用联调模板">
            <DataTable columns={['模板', '类别', '描述', '步骤', '操作']} rows={sceneTemplates.map((item) => [item.name, item.category ?? '--', item.description, item.steps.join(' → '), <ActionButton key={item.sceneTemplateId} label="运行" tone="primary" onClick={() => runAction(() => api.runSceneTemplate(item.sceneTemplateId), `已运行场景：${item.name}`)} />])} />
          </Panel>
          <Panel title="Scene DSL 草案" subtitle="为后续脚本化场景编排预留结构设计">
            <JsonBlock value={sceneDslDraft} />
          </Panel>
        </>
      ) : null}

      {activeKey === 'fault' ? (
        <>
          <Panel title="故障注入控制台" subtitle="延迟、失败、伪结果、命中统计与规则编辑" actions={<div className="button-group">{faultRules[0] ? <ActionButton label="模拟首条规则命中" tone="danger" onClick={() => runAction(() => api.simulateFaultHit(faultRules[0].faultRuleId), '已模拟规则命中')} /> : null}</div>}>
            <FormGrid>
              <TextInput label="规则名称" value={faultName} onChange={setFaultName} placeholder="输入规则名称" />
              <TextInput label="Matcher(JSON)" value={faultMatcher} onChange={setFaultMatcher} placeholder='{"taskType":"APP_UPGRADE"}' multiline minRows={6} />
              <TextInput label="Action(JSON)" value={faultAction} onChange={setFaultAction} placeholder='{"type":"TIMEOUT","timeoutMs":15000}' multiline minRows={6} />
            </FormGrid>
            <div className="button-group inline-actions">
              <ActionButton label="新增故障规则" onClick={() => runAction(async () => { if (!faultName.trim()) throw new Error('规则名称不能为空'); await api.createFaultRule({ name: faultName, targetType: 'TDP_DELIVERY', matcher: JSON.parse(faultMatcher), action: JSON.parse(faultAction) }) }, '已新增故障规则')} />
              {faultRules[0] ? <ActionButton label="更新首条规则" tone="primary" onClick={() => runAction(() => api.updateFaultRule(faultRules[0].faultRuleId, { name: faultName, matcher: JSON.parse(faultMatcher), action: JSON.parse(faultAction), enabled: true }), '已更新故障规则')} /> : null}
            </div>
            <DataTable columns={['规则', '目标', 'Matcher', 'Action', '命中次数', '更新时间']} rows={faultRules.map((item) => [item.name, item.targetType, JSON.stringify(item.matcher), JSON.stringify(item.action), item.hitCount, formatTime(item.updatedAt)])} />
          </Panel>
          <Panel title="调试原则" subtitle="Mock-only 能力与真实边界严格隔离">
            <KeyValueList items={[{ label: '边界', value: 'TCP 负责控制治理，TDP 负责投递与投影，不混边界' }, { label: '自由度', value: '后台允许强制改状态、写伪结果、造数据，但都通过 Mock 专用接口' }, { label: '可观测', value: '所有异常都应可通过实例、Projection、Change Log 回看' }, { label: '可演进', value: '后续可补更细粒度 Fault DSL 与 Replay 轨迹' }]} />
          </Panel>
        </>
      ) : null}

      {activeKey === 'master-data' ? (
        <>
          <Panel title="基础资料中心" subtitle="建议按“平台 → 项目 / 租户 / 品牌 → 门店 → 合同 → 终端机型 → 终端模板”的顺序维护，先确定业务组织，再落执行对象">
            <div className="three-column inline-actions">
              <KeyValueList
                items={[
                  { label: '推荐顺序 1', value: '先建平台。平台代表购物中心集团，是天然业务隔离器。' },
                  { label: '推荐顺序 2', value: '再建项目、租户、品牌，这些都是上游同步来的平台内参考数据。' },
                ]}
              />
              <KeyValueList
                items={[
                  { label: '推荐顺序 3', value: '再建门店。门店是项目 + 租户 + 品牌 + 铺位号的执行对象。' },
                  { label: '推荐顺序 4', value: '最后建合同、终端机型、终端模板，供执行链路引用。' },
                ]}
              />
              <JsonBlock value={{ recommendedOrder: ['平台', '项目', '租户', '品牌', '门店', '合同', '终端机型', '终端模板'] }} />
            </div>
            <div className="inline-actions">
              <SelectInput
                label="当前平台上下文"
                value={currentMasterPlatformId}
                onChange={(value) => {
                  setSelectedMasterPlatformId(value)
                  setMasterFocus(null)
                }}
                options={platforms.map((item) => ({ label: item.platformName, value: item.platformId }))}
              />
              <div className="feedback">{currentMasterPlatform ? `当前正在维护：${currentMasterPlatform.platformName}` : '请先创建平台'}</div>
            </div>
            <div className="master-tab-list">
              {masterTabs.map((tab) => (
                <button type="button" key={tab.key} className={`master-tab ${masterTab === tab.key ? 'active' : ''}`} onClick={() => setMasterTab(tab.key)}>
                  <span>{`${masterTabs.findIndex((item) => item.key === tab.key) + 1}. ${tab.label}`}</span>
                  <span className="nav-badge">{tab.count}</span>
                </button>
              ))}
            </div>
            {masterFocus?.tab === masterTab ? (
              <div className="inline-actions">
                <div className="feedback success">已聚焦到：{masterFocus.keyword}</div>
                <ActionButton label="清除聚焦" onClick={() => setMasterFocus(null)} />
              </div>
            ) : null}
          </Panel>

          {masterTab === 'platforms' ? (
            <Panel title="平台" subtitle="第 1 步：维护购物中心集团。平台是项目、租户、品牌、门店、合同的天然隔离器">
              <div className="two-column">
                <DataTable columns={['平台名', '编码', '项目数', '门店数', '操作']} rows={focusedPlatforms.map((item) => [item.platformName, item.platformCode, item.projectCount ?? 0, item.storeCount ?? 0, <div key={item.platformId} className="button-group"><ActionButton label="详情" onClick={() => openDetail(`平台 ${item.platformName}`, buildPlatformDetail(item.platformId) ?? item)} /><ActionButton label="编辑" onClick={() => loadPlatformForEdit(item.platformId)} /><ActionButton label="切换上下文" onClick={() => setSelectedMasterPlatformId(item.platformId)} /><ActionButton label="删除" tone="danger" onClick={() => deleteMasterEntity('platform', item.platformId, async () => { await api.deletePlatform(item.platformId); if (currentMasterPlatformId === item.platformId) setSelectedMasterPlatformId('') }, '已删除平台')} /></div>])} />
                <FormGrid>
                  <TextInput label="平台编码" value={platformDraftCode} onChange={setPlatformDraftCode} placeholder="如 WANDA_GROUP" />
                  <TextInput label="平台名称" value={platformDraftName} onChange={setPlatformDraftName} placeholder="如 万达集团" />
                  <ActionButton
                    label={editingMasterEntity?.type === 'platform' ? '保存平台' : '新增平台'}
                    tone="primary"
                    onClick={() =>
                      runAction(async () => {
                        if (!platformDraftCode.trim() || !platformDraftName.trim()) throw new Error('平台编码和名称不能为空')
                        if (editingMasterEntity?.type === 'platform') {
                          await api.updatePlatform(editingMasterEntity.id, { platformCode: platformDraftCode, platformName: platformDraftName, status: 'ACTIVE', description: '基础资料中心更新' })
                        } else {
                          await api.createPlatform({ platformCode: platformDraftCode, platformName: platformDraftName, status: 'ACTIVE', description: '基础资料中心创建' })
                        }
                        setPlatformDraftCode('')
                        setPlatformDraftName('')
                        setEditingMasterEntity(null)
                      }, editingMasterEntity?.type === 'platform' ? '已更新平台' : '已新增平台')
                    }
                  />
                  {editingMasterEntity?.type === 'platform' ? <ActionButton label="取消编辑" onClick={() => { setEditingMasterEntity(null); setPlatformDraftCode(''); setPlatformDraftName('') }} /> : null}
                </FormGrid>
              </div>
            </Panel>
          ) : null}

          {masterTab === 'projects' ? (
            <Panel title="项目" subtitle="第 2 步：维护购物中心项目。每个项目只归属于一个平台">
              <div className="two-column">
                <DataTable columns={['项目名', '编码', '所属平台', '门店数', '终端数', '操作']} rows={focusedProjects.map((item) => [item.projectName, item.projectCode, item.platformName ?? '--', item.storeCount ?? 0, item.terminalCount ?? 0, <div key={item.projectId} className="button-group"><ActionButton label="详情" onClick={() => openDetail(`项目 ${item.projectName}`, buildProjectDetail(item.projectId) ?? item)} /><ActionButton label="编辑" onClick={() => loadProjectForEdit(item.projectId)} /><ActionButton label="删除" tone="danger" onClick={() => deleteMasterEntity('project', item.projectId, () => api.deleteProject(item.projectId), '已删除项目')} /></div>])} />
                <FormGrid>
                  <TextInput label="项目编码" value={projectDraftCode} onChange={setProjectDraftCode} placeholder="如 SHENZHEN_BAY_MIXC" />
                  <TextInput label="项目名称" value={projectDraftName} onChange={setProjectDraftName} placeholder="如 深圳湾万象城" />
                  <ActionButton
                    label={editingMasterEntity?.type === 'project' ? '保存项目' : '新增项目'}
                    tone="primary"
                    onClick={() =>
                      runAction(async () => {
                        if (!currentMasterPlatformId) throw new Error('请先选择平台')
                        if (!projectDraftCode.trim() || !projectDraftName.trim()) throw new Error('请先填写完整项目信息')
                        if (editingMasterEntity?.type === 'project') {
                          await api.updateProject(editingMasterEntity.id, { platformId: currentMasterPlatformId, projectCode: projectDraftCode, projectName: projectDraftName, status: 'ACTIVE', description: '基础资料中心更新', region: 'CN', timezone: 'Asia/Shanghai' })
                        } else {
                          await api.createProject({ platformId: currentMasterPlatformId, projectCode: projectDraftCode, projectName: projectDraftName, status: 'ACTIVE', description: '基础资料中心创建', region: 'CN', timezone: 'Asia/Shanghai' })
                        }
                        setProjectDraftCode('')
                        setProjectDraftName('')
                        setEditingMasterEntity(null)
                      }, editingMasterEntity?.type === 'project' ? '已更新项目' : '已新增项目')
                    }
                  />
                  {editingMasterEntity?.type === 'project' ? <ActionButton label="取消编辑" onClick={() => { setEditingMasterEntity(null); setProjectDraftCode(''); setProjectDraftName('') }} /> : null}
                </FormGrid>
              </div>
            </Panel>
          ) : null}

          {masterTab === 'tenants' ? (
            <Panel title="租户" subtitle="第 3 步：维护经营主体。租户按平台隔离，同名租户可以存在于不同平台">
              <div className="two-column">
                <DataTable columns={['租户名', '编码', '所属平台', '项目数', '门店数', '操作']} rows={focusedTenants.map((item) => [item.tenantName, item.tenantCode, item.platformName ?? '--', item.projectCount ?? 0, item.storeCount ?? 0, <div key={item.tenantId} className="button-group"><ActionButton label="详情" onClick={() => openDetail(`租户 ${item.tenantName}`, buildTenantDetail(item.tenantId) ?? item)} /><ActionButton label="编辑" onClick={() => loadTenantForEdit(item.tenantId)} /><ActionButton label="删除" tone="danger" onClick={() => deleteMasterEntity('tenant', item.tenantId, () => api.deleteTenant(item.tenantId), '已删除租户')} /></div>])} />
                <FormGrid>
                  <TextInput label="租户编码" value={tenantDraftCode} onChange={setTenantDraftCode} placeholder="如 MCDONALD_SZ" />
                  <TextInput label="租户名称" value={tenantDraftName} onChange={setTenantDraftName} placeholder="如 麦当劳深圳有限公司" />
                  <ActionButton
                    label={editingMasterEntity?.type === 'tenant' ? '保存租户' : '新增租户'}
                    tone="primary"
                    onClick={() =>
                      runAction(async () => {
                        if (!currentMasterPlatformId) throw new Error('请先选择平台')
                        if (!tenantDraftCode.trim() || !tenantDraftName.trim()) throw new Error('租户编码和名称不能为空')
                        if (editingMasterEntity?.type === 'tenant') {
                          await api.updateTenant(editingMasterEntity.id, { platformId: currentMasterPlatformId, tenantCode: tenantDraftCode, tenantName: tenantDraftName, status: 'ACTIVE', description: '基础资料中心更新' })
                        } else {
                          await api.createTenant({ platformId: currentMasterPlatformId, tenantCode: tenantDraftCode, tenantName: tenantDraftName, status: 'ACTIVE', description: '基础资料中心创建' })
                        }
                        setTenantDraftCode('')
                        setTenantDraftName('')
                        setEditingMasterEntity(null)
                      }, editingMasterEntity?.type === 'tenant' ? '已更新租户' : '已新增租户')
                    }
                  />
                  {editingMasterEntity?.type === 'tenant' ? <ActionButton label="取消编辑" onClick={() => { setEditingMasterEntity(null); setTenantDraftCode(''); setTenantDraftName('') }} /> : null}
                </FormGrid>
              </div>
            </Panel>
          ) : null}

          {masterTab === 'brands' ? (
            <Panel title="品牌" subtitle="第 4 步：维护品牌主数据。品牌按平台隔离，同名品牌可以存在于不同平台">
              <div className="two-column">
                <DataTable columns={['品牌名', '编码', '所属平台', '门店数', '项目数', '操作']} rows={focusedBrands.map((item) => [item.brandName, item.brandCode, item.platformName ?? '--', item.storeCount ?? 0, item.projectCount ?? 0, <div key={item.brandId} className="button-group"><ActionButton label="详情" onClick={() => openDetail(`品牌 ${item.brandName}`, buildBrandDetail(item.brandId) ?? item)} /><ActionButton label="编辑" onClick={() => loadBrandForEdit(item.brandId)} /><ActionButton label="删除" tone="danger" onClick={() => deleteMasterEntity('brand', item.brandId, () => api.deleteBrand(item.brandId), '已删除品牌')} /></div>])} />
                <FormGrid>
                  <TextInput label="品牌编码" value={brandDraftCode} onChange={setBrandDraftCode} placeholder="如 KFC" />
                  <TextInput label="品牌名称" value={brandDraftName} onChange={setBrandDraftName} placeholder="如 肯德基" />
                  <ActionButton
                    label={editingMasterEntity?.type === 'brand' ? '保存品牌' : '新增品牌'}
                    tone="primary"
                    onClick={() =>
                      runAction(async () => {
                        if (!currentMasterPlatformId) throw new Error('请先选择平台')
                        if (!brandDraftCode.trim() || !brandDraftName.trim()) throw new Error('请先填写完整品牌信息')
                        if (editingMasterEntity?.type === 'brand') {
                          await api.updateBrand(editingMasterEntity.id, { platformId: currentMasterPlatformId, brandCode: brandDraftCode, brandName: brandDraftName, status: 'ACTIVE', description: '基础资料中心更新' })
                        } else {
                          await api.createBrand({ platformId: currentMasterPlatformId, brandCode: brandDraftCode, brandName: brandDraftName, status: 'ACTIVE', description: '基础资料中心创建' })
                        }
                        setBrandDraftCode('')
                        setBrandDraftName('')
                        setEditingMasterEntity(null)
                      }, editingMasterEntity?.type === 'brand' ? '已更新品牌' : '已新增品牌')
                    }
                  />
                  {editingMasterEntity?.type === 'brand' ? <ActionButton label="取消编辑" onClick={() => { setEditingMasterEntity(null); setBrandDraftCode(''); setBrandDraftName('') }} /> : null}
                </FormGrid>
              </div>
            </Panel>
          ) : null}

          {masterTab === 'stores' ? (
            <Panel title="门店" subtitle="第 5 步：把项目、租户、品牌和铺位号装配成真实门店。门店是终端落地的执行对象">
              <div className="two-column">
                <DataTable columns={['门店名', '门店编码', '铺位号', '项目', '品牌', '合同数', '操作']} rows={focusedStores.map((item) => [item.storeName, item.storeCode, item.unitCode, item.projectName ?? '--', item.brandName ?? '--', item.contractCount ?? 0, <div key={item.storeId} className="button-group"><ActionButton label="详情" onClick={() => openDetail(`门店 ${item.storeName}`, buildStoreDetail(item.storeId) ?? item)} /><ActionButton label="编辑" onClick={() => loadStoreForEdit(item.storeId)} /><ActionButton label="删除" tone="danger" onClick={() => deleteMasterEntity('store', item.storeId, () => api.deleteStore(item.storeId), '已删除门店')} /></div>])} />
                <div>
                  <FormGrid>
                    <SelectInput label="所属项目" value={storeDraftProjectId} onChange={setStoreDraftProjectId} options={platformScopedProjects.map((item) => ({ label: item.projectName, value: item.projectId }))} />
                    <SelectInput label="所属租户" value={storeDraftTenantId} onChange={setStoreDraftTenantId} options={platformScopedTenants.map((item) => ({ label: item.tenantName, value: item.tenantId }))} />
                    <SelectInput label="所属品牌" value={storeDraftBrandId} onChange={setStoreDraftBrandId} options={platformScopedBrands.map((item) => ({ label: item.brandName, value: item.brandId }))} />
                    <TextInput label="铺位号" value={storeDraftUnitCode} onChange={setStoreDraftUnitCode} placeholder="如 L0102" />
                    <TextInput label="门店编码" value={storeDraftCode} onChange={setStoreDraftCode} placeholder="如 KFC_SZBAY_L0102" />
                    <TextInput label="门店名称" value={storeDraftName} onChange={setStoreDraftName} placeholder="如 肯德基（深圳湾万象城店）" />
                    <ActionButton
                      label={editingMasterEntity?.type === 'store' ? '保存门店' : '新增门店'}
                      tone="primary"
                      onClick={() =>
                        runAction(async () => {
                          if (!currentMasterPlatformId) throw new Error('请先选择平台')
                          if (!storeDraftTenantId || !storeDraftBrandId || !storeDraftProjectId || !storeDraftUnitCode.trim() || !storeDraftCode.trim() || !storeDraftName.trim()) throw new Error('请先填写完整门店信息')
                          if (editingMasterEntity?.type === 'store') {
                            await api.updateStore(editingMasterEntity.id, { platformId: currentMasterPlatformId, tenantId: storeDraftTenantId, brandId: storeDraftBrandId, projectId: storeDraftProjectId, unitCode: storeDraftUnitCode, storeCode: storeDraftCode, storeName: storeDraftName, status: 'ACTIVE', description: '基础资料中心更新' })
                          } else {
                            await api.createStore({ platformId: currentMasterPlatformId, tenantId: storeDraftTenantId, brandId: storeDraftBrandId, projectId: storeDraftProjectId, unitCode: storeDraftUnitCode, storeCode: storeDraftCode, storeName: storeDraftName, status: 'ACTIVE', description: '基础资料中心创建' })
                          }
                          setStoreDraftUnitCode('')
                          setStoreDraftCode('')
                          setStoreDraftName('')
                          setEditingMasterEntity(null)
                        }, editingMasterEntity?.type === 'store' ? '已更新门店' : '已新增门店')
                      }
                    />
                    {editingMasterEntity?.type === 'store' ? <ActionButton label="取消编辑" onClick={() => { setEditingMasterEntity(null); setStoreDraftUnitCode(''); setStoreDraftCode(''); setStoreDraftName('') }} /> : null}
                  </FormGrid>
                  <Panel title="门店装配摘要" subtitle="实时确认你正在创建的是哪一家门店，避免项目、租户、品牌、铺位号组合错误">
                    <KeyValueList
                      items={[
                        { label: '平台', value: currentMasterPlatform?.platformName ?? '待选择' },
                        { label: '项目', value: selectedStoreDraftProject?.projectName ?? '待选择' },
                        { label: '租户', value: selectedStoreDraftTenant?.tenantName ?? '待选择' },
                        { label: '品牌', value: selectedStoreDraftBrand?.brandName ?? '待选择' },
                        { label: '铺位号', value: storeDraftUnitCode.trim() || '待填写' },
                        { label: '最终结果', value: currentMasterPlatform && selectedStoreDraftProject && selectedStoreDraftTenant && selectedStoreDraftBrand && storeDraftName.trim() ? `${currentMasterPlatform.platformName} / ${selectedStoreDraftProject.projectName} / ${selectedStoreDraftTenant.tenantName} / ${selectedStoreDraftBrand.brandName} / ${storeDraftUnitCode.trim()} / ${storeDraftName.trim()}` : '等待完成装配' },
                      ]}
                    />
                  </Panel>
                </div>
              </div>
            </Panel>
          ) : null}

          {masterTab === 'contracts' ? (
            <Panel title="合同" subtitle="第 6 步：维护经营/租赁合同。一个门店可以挂多份合同，合同必须归属于明确门店">
              <div className="two-column">
                <DataTable columns={['合同编码', '门店', '铺位号', '项目', '起止日期', '操作']} rows={focusedContracts.map((item) => [item.contractCode, item.storeName ?? '--', item.unitCode, item.projectName ?? '--', `${item.startDate ?? '--'} ~ ${item.endDate ?? '--'}`, <div key={item.contractId} className="button-group"><ActionButton label="详情" onClick={() => openDetail(`合同 ${item.contractCode}`, buildContractDetail(item.contractId) ?? item)} /><ActionButton label="编辑" onClick={() => loadContractForEdit(item.contractId)} /><ActionButton label="删除" tone="danger" onClick={() => deleteMasterEntity('contract', item.contractId, () => api.deleteContract(item.contractId), '已删除合同')} /></div>])} />
                <div>
                  <FormGrid>
                    <SelectInput label="所属项目" value={contractDraftProjectId} onChange={setContractDraftProjectId} options={platformScopedProjects.map((item) => ({ label: item.projectName, value: item.projectId }))} />
                    <SelectInput label="所属租户" value={contractDraftTenantId} onChange={setContractDraftTenantId} options={platformScopedTenants.map((item) => ({ label: item.tenantName, value: item.tenantId }))} />
                    <SelectInput label="所属品牌" value={contractDraftBrandId} onChange={setContractDraftBrandId} options={platformScopedBrands.map((item) => ({ label: item.brandName, value: item.brandId }))} />
                    <SelectInput label="所属门店" value={contractDraftStoreId} onChange={setContractDraftStoreId} options={platformScopedStores.map((item) => ({ label: `${item.storeName} (${item.unitCode})`, value: item.storeId }))} />
                    <TextInput label="合同编码" value={contractDraftCode} onChange={setContractDraftCode} placeholder="如 CONTRACT_GZ_TIANHUAN_KFC_01" />
                    <TextInput label="铺位号" value={contractDraftUnitCode} onChange={setContractDraftUnitCode} placeholder="如 L0102" />
                    <TextInput label="开始日期" value={contractDraftStartDate} onChange={setContractDraftStartDate} placeholder="如 2026-01-01" />
                    <TextInput label="结束日期" value={contractDraftEndDate} onChange={setContractDraftEndDate} placeholder="如 2026-12-31" />
                    <ActionButton
                      label={editingMasterEntity?.type === 'contract' ? '保存合同' : '新增合同'}
                      tone="primary"
                      onClick={() =>
                        runAction(async () => {
                          if (!currentMasterPlatformId) throw new Error('请先选择平台')
                          if (!contractDraftProjectId || !contractDraftTenantId || !contractDraftBrandId || !contractDraftStoreId || !contractDraftCode.trim() || !contractDraftUnitCode.trim()) throw new Error('请先填写完整合同信息')
                          const payload = {
                            platformId: currentMasterPlatformId,
                            projectId: contractDraftProjectId,
                            tenantId: contractDraftTenantId,
                            brandId: contractDraftBrandId,
                            storeId: contractDraftStoreId,
                            contractCode: contractDraftCode,
                            unitCode: contractDraftUnitCode,
                            startDate: contractDraftStartDate || undefined,
                            endDate: contractDraftEndDate || undefined,
                            status: 'ACTIVE',
                            description: '基础资料中心维护',
                          }
                          if (editingMasterEntity?.type === 'contract') {
                            await api.updateContract(editingMasterEntity.id, payload)
                          } else {
                            await api.createContract(payload)
                          }
                          setContractDraftCode('')
                          setContractDraftUnitCode('')
                          setEditingMasterEntity(null)
                        }, editingMasterEntity?.type === 'contract' ? '已更新合同' : '已新增合同')
                      }
                    />
                    {editingMasterEntity?.type === 'contract' ? <ActionButton label="取消编辑" onClick={() => { setEditingMasterEntity(null); setContractDraftCode(''); setContractDraftUnitCode('') }} /> : null}
                  </FormGrid>
                  <Panel title="合同摘要" subtitle="确认当前合同落在哪个平台、项目、门店上">
                    <KeyValueList
                      items={[
                        { label: '平台', value: currentMasterPlatform?.platformName ?? '待选择' },
                        { label: '项目', value: platformScopedProjects.find((item) => item.projectId === contractDraftProjectId)?.projectName ?? '待选择' },
                        { label: '租户', value: platformScopedTenants.find((item) => item.tenantId === contractDraftTenantId)?.tenantName ?? '待选择' },
                        { label: '品牌', value: platformScopedBrands.find((item) => item.brandId === contractDraftBrandId)?.brandName ?? '待选择' },
                        { label: '门店', value: selectedContractDraftStore?.storeName ?? '待选择' },
                        { label: '铺位号', value: contractDraftUnitCode.trim() || selectedContractDraftStore?.unitCode || '待填写' },
                      ]}
                    />
                  </Panel>
                </div>
              </div>
            </Panel>
          ) : null}

          {masterTab === 'profiles' ? (
            <Panel title="终端机型" subtitle="第 5 步：定义终端类型与硬件能力，如安卓收银机、自助点餐屏、手持点餐 PDA">
              <div className="two-column">
                <DataTable columns={['机型编码', '机型名称', '模板数', '终端数', '操作']} rows={focusedProfiles.map((item) => [item.profileCode, item.name, item.templateCount ?? 0, item.terminalCount ?? 0, <div key={item.profileId} className="button-group"><ActionButton label="详情" onClick={() => openDetail(`终端机型 ${item.name}`, buildProfileDetail(item.profileId) ?? item)} /><ActionButton label="编辑" onClick={() => loadProfileForEdit(item.profileId)} /><ActionButton label="删除" tone="danger" onClick={() => deleteMasterEntity('profile', item.profileId, () => api.deleteProfile(item.profileId), '已删除终端机型')} /></div>])} />
                <div className="inline-actions">
                  <FormGrid columns={3}>
                    <TextInput label="机型编码" value={profileDraftCode} onChange={setProfileDraftCode} placeholder="如 ANDROID_POS" />
                    <TextInput label="机型名称" value={profileDraftName} onChange={setProfileDraftName} placeholder="如 安卓收银机" />
                    <ActionButton
                      label={editingMasterEntity?.type === 'profile' ? '保存终端机型' : '新增终端机型'}
                      tone="primary"
                      onClick={() =>
                        runAction(async () => {
                          if (!profileDraftCode.trim() || !profileDraftName.trim()) throw new Error('请先填写完整机型信息')
                          if (editingMasterEntity?.type === 'profile') {
                            await api.updateProfile(editingMasterEntity.id, {
                              profileCode: profileDraftCode,
                              name: profileDraftName,
                              description: '基础资料中心更新',
                              capabilities: { supportsPrinter: true, supportsScanner: true },
                            })
                          } else {
                            await api.createProfile({
                              profileCode: profileDraftCode,
                              name: profileDraftName,
                              description: '基础资料中心创建',
                              capabilities: { supportsPrinter: true, supportsScanner: true },
                            })
                          }
                          setProfileDraftCode('')
                          setProfileDraftName('')
                          setEditingMasterEntity(null)
                        }, editingMasterEntity?.type === 'profile' ? '已更新终端机型' : '已新增终端机型')
                      }
                    />
                    {editingMasterEntity?.type === 'profile' ? <ActionButton label="取消编辑" onClick={() => { setEditingMasterEntity(null); setProfileDraftCode(''); setProfileDraftName('') }} /> : null}
                  </FormGrid>
                </div>
              </div>
            </Panel>
          ) : null}

          {masterTab === 'templates' ? (
            <Panel title="终端模板" subtitle="第 6 步：为终端机型准备可复用模板，供激活码和终端实例直接引用">
              <div className="two-column">
                <DataTable columns={['模板编码', '模板名称', '适用机型', '激活码数', '终端数', '操作']} rows={focusedTemplates.map((item) => [item.templateCode, item.name, profiles.find((profile) => profile.profileId === item.profileId)?.name ?? item.profileId, item.activationCodeCount ?? 0, item.terminalCount ?? 0, <div key={item.templateId} className="button-group"><ActionButton label="详情" onClick={() => openDetail(`终端模板 ${item.name}`, buildTemplateDetail(item.templateId) ?? item)} /><ActionButton label="编辑" onClick={() => loadTemplateForEdit(item.templateId)} /><ActionButton label="删除" tone="danger" onClick={() => deleteMasterEntity('template', item.templateId, () => api.deleteTemplate(item.templateId), '已删除终端模板')} /></div>])} />
                <div className="inline-actions">
                  <FormGrid columns={3}>
                    <TextInput label="模板编码" value={templateDraftCode} onChange={setTemplateDraftCode} placeholder="如 ANDROID_POS_STANDARD" />
                    <TextInput label="模板名称" value={templateDraftName} onChange={setTemplateDraftName} placeholder="如 安卓收银机标准模板" />
                    <SelectInput label="适用机型" value={templateDraftProfileId} onChange={setTemplateDraftProfileId} options={profiles.map((item) => ({ label: item.name, value: item.profileId }))} />
                    <ActionButton
                      label={editingMasterEntity?.type === 'template' ? '保存终端模板' : '新增终端模板'}
                      tone="primary"
                      onClick={() =>
                        runAction(async () => {
                          if (!templateDraftProfileId) throw new Error('请选择适用机型')
                          if (!templateDraftCode.trim() || !templateDraftName.trim()) throw new Error('请先填写完整模板信息')
                          if (editingMasterEntity?.type === 'template') {
                            await api.updateTemplate(editingMasterEntity.id, {
                              templateCode: templateDraftCode,
                              name: templateDraftName,
                              description: '基础资料中心更新',
                              profileId: templateDraftProfileId,
                              presetConfig: { app: { locale: 'zh-CN' } },
                              presetTags: ['master-data'],
                            })
                          } else {
                            await api.createTemplate({
                              templateCode: templateDraftCode,
                              name: templateDraftName,
                              description: '基础资料中心创建',
                              profileId: templateDraftProfileId,
                              presetConfig: { app: { locale: 'zh-CN' } },
                              presetTags: ['master-data'],
                            })
                          }
                          setTemplateDraftCode('')
                          setTemplateDraftName('')
                          setEditingMasterEntity(null)
                        }, editingMasterEntity?.type === 'template' ? '已更新终端模板' : '已新增终端模板')
                      }
                    />
                    {editingMasterEntity?.type === 'template' ? <ActionButton label="取消编辑" onClick={() => { setEditingMasterEntity(null); setTemplateDraftCode(''); setTemplateDraftName('') }} /> : null}
                  </FormGrid>
                </div>
              </div>
            </Panel>
          ) : null}
        </>
      ) : null}


      {editingSandboxId ? (
        <div className="detail-drawer" role="dialog" aria-label="沙箱管理">
          <div className="detail-drawer-panel">
            <div className="panel-header">
              <div>
                <h2>{editingSandboxId === 'create' ? '新建沙箱' : '管理沙箱'}</h2>
                <p>支持空沙箱创建，或从现有沙箱复制基础配置数据。</p>
              </div>
              <ActionButton label="关闭" onClick={() => setEditingSandboxId('')} />
            </div>

            <Panel title="沙箱列表" subtitle="默认沙箱不可重命名、不可停用" dense>
              <DataTable
                columns={['名称', '类型', '状态', '用途', '来源', '更新时间', '操作']}
                rows={sandboxes.map((item) => [
                  item.name,
                  item.isSystemDefault ? '系统默认' : '普通',
                  item.status,
                  item.purpose,
                  item.sourceSandboxId ?? '--',
                  formatTime(item.updatedAt),
                  <div key={item.sandboxId} className="button-group">
                    <ActionButton label="切换" onClick={() => runAction(async () => { resetSandboxScopedDetailState(); const nextContext = await api.switchCurrentSandbox(item.sandboxId); api.setCurrentSandboxId(nextContext.currentSandboxId); setRuntimeContext(nextContext); setEditingSandboxId('') }, `已切换到沙箱：${item.name}`)} />
                    {!item.isSystemDefault ? <ActionButton label="载入编辑" onClick={() => { setEditingSandboxId(item.sandboxId); setSandboxDraftName(item.name); setSandboxDraftDescription(item.description); setSandboxDraftPurpose(item.purpose); setSandboxDraftLimits(JSON.stringify(item.resourceLimits, null, 2)); setSandboxDraftMode(item.creationMode); setSandboxDraftSourceId(item.sourceSandboxId ?? '') }} /> : null}
                  </div>,
                ])}
              />
            </Panel>

            <Panel title={editingSandboxId === 'create' ? '创建沙箱' : '编辑沙箱'} subtitle="创建后立即可切换；复制模式只复制基础配置，不复制运行态" dense>
              <FormGrid>
                <TextInput label="名称" value={sandboxDraftName} onChange={setSandboxDraftName} placeholder="输入沙箱名称" />
                <TextInput label="用途" value={sandboxDraftPurpose} onChange={setSandboxDraftPurpose} placeholder="如 integration / regression" />
                <TextInput label="描述" value={sandboxDraftDescription} onChange={setSandboxDraftDescription} placeholder="描述该沙箱用途" multiline minRows={4} />
                <SelectInput label="创建方式" value={sandboxDraftMode} onChange={setSandboxDraftMode} options={[{ label: '空沙箱', value: 'EMPTY' }, { label: '复制基础数据', value: 'CLONE_BASELINE' }]} />
                {sandboxDraftMode === 'CLONE_BASELINE' ? <SelectInput label="来源沙箱" value={sandboxDraftSourceId} onChange={setSandboxDraftSourceId} options={creatableSourceSandboxes.map((item) => ({ label: item.name, value: item.sandboxId }))} /> : null}
                <TextInput label="资源上限(JSON)" value={sandboxDraftLimits} onChange={setSandboxDraftLimits} multiline minRows={6} placeholder='{"maxTerminals":200}' />
              </FormGrid>
              <div className="button-group inline-actions">
                {editingSandboxId === 'create' ? (
                  <ActionButton
                    label="确认创建"
                    tone="primary"
                    onClick={() => runAction(async () => {
                      await api.createSandbox({
                        name: sandboxDraftName,
                        description: sandboxDraftDescription,
                        purpose: sandboxDraftPurpose,
                        creationMode: sandboxDraftMode,
                        sourceSandboxId: sandboxDraftMode === 'CLONE_BASELINE' ? sandboxDraftSourceId : undefined,
                        resourceLimits: JSON.parse(sandboxDraftLimits),
                      })
                      setEditingSandboxId('')
                      setSandboxDraftName('')
                      setSandboxDraftDescription('')
                      setSandboxDraftPurpose('integration')
                      setSandboxDraftMode('EMPTY')
                      setSandboxDraftSourceId('')
                    }, '已创建沙箱')}
                  />
                ) : (
                  <ActionButton
                    label="保存修改"
                    tone="primary"
                    onClick={() => runAction(async () => {
                      await api.updateSandbox(editingSandboxId, {
                        name: sandboxDraftName,
                        description: sandboxDraftDescription,
                        purpose: sandboxDraftPurpose,
                        resourceLimits: JSON.parse(sandboxDraftLimits),
                      })
                      setEditingSandboxId('')
                    }, '已更新沙箱')}
                  />
                )}
                {editingSandboxId && editingSandboxId !== 'create' && !sandboxes.find((item) => item.sandboxId === editingSandboxId)?.isSystemDefault ? (
                  <ActionButton label="停用此沙箱" tone="danger" onClick={() => runAction(async () => { await api.updateSandbox(editingSandboxId, { status: 'PAUSED' }); setEditingSandboxId('') }, '已停用沙箱')} />
                ) : null}
              </div>
            </Panel>
          </div>
        </div>
      ) : null}

      {detailPayload ? (
        <div className="detail-drawer" role="dialog" aria-label={detailTitle}>
          <div className="detail-drawer-panel">
            <div className="panel-header">
              <div>
                <h2>{detailTitle}</h2>
                <p>当前选中对象的摘要、关联关系与完整调试上下文</p>
              </div>
              <ActionButton label="关闭" onClick={closeDetail} />
            </div>
            {renderDetailContent()}
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}
