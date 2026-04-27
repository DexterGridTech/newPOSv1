import React, {useEffect, useState} from 'react'
import {ScrollView, Text, View} from 'react-native'
import {useSelector} from 'react-redux'
import type {RootState} from '@next/kernel-base-state-runtime'
import {selectTcpIdentitySnapshot} from '@next/kernel-base-tcp-control-runtime-v2'
import {selectTopologyDisplayMode} from '@next/kernel-base-topology-runtime-v3'
import {
    selectCurrentActiveContract,
    selectCurrentBrandProfile,
    selectCurrentPlatformProfile,
    selectCurrentProjectProfile,
    selectCurrentRegionProfile,
    selectCurrentStoreProfile,
    selectCurrentStoreTables,
    selectCurrentStoreWorkstations,
    selectCurrentTenantBusinessEntities,
    selectCurrentTenantProfile,
    selectIamReadinessSummary,
    selectOrganizationIamAllRecords,
    selectOrganizationIamDiagnostics,
    selectOrganizationIamSummary,
    selectOrganizationTree,
    selectStoreEffectivePermissions,
    selectStoreEffectiveRoles,
    selectStoreEffectiveUserRoleBindings,
    selectStoreEffectiveUsers,
} from '@next/kernel-business-organization-iam-master-data'
import {
    selectAllProductCategories,
    selectAllCateringProducts,
    selectAllChannelProductMappings,
    selectAllProductInheritances,
    selectCateringProductDiagnostics,
    selectCateringProductDisplayModel,
    selectCateringProductSummary,
    selectCurrentStoreEffectiveMenu,
    selectLatestCateringProduct,
} from '@next/kernel-business-catering-product-master-data'
import {
    selectCateringStoreOperatingDiagnostics,
    selectCurrentStoreConfig,
    selectCateringStoreOperatingSummary,
    selectOperationDashboardModel,
    selectStoreOperatingStatus,
} from '@next/kernel-business-catering-store-operating-master-data'
import {
    useOptionalUiAutomationBridge,
    useOptionalUiAutomationRuntimeId,
    useOptionalUiAutomationTarget,
    useUiRuntime,
} from '@next/ui-base-runtime-react'
import type {MasterDataWorkbenchScreenProps} from '../../types'

type DomainKey = 'organization' | 'product' | 'operation' | 'inspector'

const panelShadow = {
    boxShadow: '0px 18px 38px rgba(15, 23, 42, 0.10)',
} as const

const domainLabels: Record<DomainKey, string> = {
    organization: '组织与权限',
    product: '餐饮商品',
    operation: '经营配置',
    inspector: '投影诊断',
}

const asJson = (value: unknown) => JSON.stringify(value, null, 2)

const MetricCard: React.FC<{
    label: string
    value: string | number
    tone?: 'blue' | 'green' | 'amber' | 'slate'
}> = ({label, value, tone = 'slate'}) => {
    const palette = {
        blue: ['#eff6ff', '#2563eb'],
        green: ['#ecfdf5', '#059669'],
        amber: ['#fffbeb', '#d97706'],
        slate: ['#f8fafc', '#475569'],
    } as const
    return (
        <View style={{
            minWidth: 128,
            flexGrow: 1,
            borderRadius: 18,
            paddingHorizontal: 16,
            paddingVertical: 14,
            backgroundColor: palette[tone][0],
            borderWidth: 1,
            borderColor: '#e2e8f0',
        }}>
            <Text style={{fontSize: 11, fontWeight: '800', color: palette[tone][1]}}>{label}</Text>
            <Text style={{marginTop: 6, fontSize: 24, lineHeight: 30, fontWeight: '900', color: '#0f172a'}}>
                {value}
            </Text>
        </View>
    )
}

const Section: React.FC<{
    title: string
    subtitle?: string
    children: React.ReactNode
}> = ({title, subtitle, children}) => (
    <View style={{
        borderRadius: 22,
        padding: 18,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#dce6f1',
        gap: 14,
        ...panelShadow,
    }}>
        <View style={{gap: 4}}>
            <Text style={{fontSize: 18, fontWeight: '900', color: '#0f172a'}}>{title}</Text>
            {subtitle ? (
                <Text style={{fontSize: 12, lineHeight: 18, color: '#64748b'}}>{subtitle}</Text>
            ) : null}
        </View>
        {children}
    </View>
)

const DataRow: React.FC<{label: string; value?: unknown}> = ({label, value}) => (
    <View style={{
        flexDirection: 'row',
        gap: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#edf2f7',
    }}>
        <Text style={{width: 120, fontSize: 12, color: '#64748b', fontWeight: '800'}}>{label}</Text>
        <Text selectable style={{flex: 1, fontSize: 13, color: '#0f172a', lineHeight: 18}}>
            {value == null || value === '' ? '-' : String(value)}
        </Text>
    </View>
)

const StatusPill: React.FC<{children: React.ReactNode; tone?: 'green' | 'amber' | 'red' | 'blue'}> = ({
    children,
    tone = 'blue',
}) => {
    const palette = {
        green: ['#dcfce7', '#166534'],
        amber: ['#fef3c7', '#92400e'],
        red: ['#fee2e2', '#991b1b'],
        blue: ['#dbeafe', '#1d4ed8'],
    } as const
    return (
        <Text style={{
            alignSelf: 'flex-start',
            borderRadius: 999,
            overflow: 'hidden',
            paddingHorizontal: 10,
            paddingVertical: 4,
            backgroundColor: palette[tone][0],
            color: palette[tone][1],
            fontSize: 11,
            fontWeight: '900',
        }}>
            {children}
        </Text>
    )
}

const OrganizationDomain: React.FC<{state: ReturnType<typeof useWorkbenchState>}> = ({state}) => (
    <View style={{gap: 16}}>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12}}>
            <MetricCard label="项目" value={state.organizationSummary.projects} tone="blue" />
            <MetricCard label="大区" value={state.organizationSummary.regions} tone="slate" />
            <MetricCard label="门店" value={state.organizationSummary.stores} tone="green" />
            <MetricCard label="桌台" value={state.tables.length} tone="amber" />
            <MetricCard label="工作站" value={state.workstations.length} tone="slate" />
            <MetricCard label="员工" value={state.organizationSummary.users} tone="slate" />
            <MetricCard label="角色" value={state.organizationSummary.roles} tone="amber" />
        </View>
        <Section title="当前终端组织链路" subtitle="按 TCP 激活绑定解析；Store 的租户和品牌来自合同快照，不在终端或门店资料里临时拼接。">
            <DataRow label="平台" value={state.platform?.platform_name ?? state.platform?.platform_id} />
            <DataRow label="项目" value={state.project?.project_name ?? state.project?.project_id} />
            <DataRow label="大区" value={state.region?.region_name ?? state.project?.region?.region_name ?? state.project?.region?.region_code} />
            <DataRow label="门店" value={state.store?.store_name ?? state.store?.store_id} />
            <DataRow label="当前租户" value={state.tenant?.tenant_name ?? state.contract?.lessee_tenant_name ?? state.store?.tenant_id} />
            <DataRow label="当前品牌" value={state.brand?.brand_name ?? state.contract?.lessee_brand_name ?? state.store?.brand_id} />
            <DataRow label="合同" value={state.contract?.contract_no ?? state.contract?.contract_code ?? state.contract?.contract_id} />
        </Section>
        <Section title="项目分期与合同快照" subtitle="合同是签署时快照；项目分期或业主方后续变化，不会反写已签合同。">
            <DataRow
                label="项目分期"
                value={(state.project?.project_phases ?? [])
                    .map(phase => `${phase.phase_name ?? phase.phase_id ?? '未命名分期'} / ${phase.owner_name ?? '未维护业主方'}`)
                    .join(', ') || '-'}
            />
            <DataRow label="合同甲方项目" value={state.contract?.lessor_project_id ?? state.contract?.project_id} />
            <DataRow label="合同甲方分期" value={state.contract?.lessor_phase_name ?? state.contract?.lessor_phase_id} />
            <DataRow label="合同业主方" value={state.contract?.lessor_owner_name} />
            <DataRow label="乙方经营主体" value={state.contract?.lessee_entity_name ?? state.contract?.entity_id} />
            <DataRow label="合同周期" value={`${state.contract?.start_date ?? '-'} ~ ${state.contract?.end_date ?? '-'}`} />
        </Section>
        <Section title="法人主体 / 桌台 / 工作站" subtitle="这里展示交易前必须存在的经营资源，不执行开台、结账、预订或生产派工。">
            <DataRow label="法人主体" value={state.businessEntities.map(item => item.entity_name ?? item.entity_id).join(', ') || '-'} />
            <DataRow
                label="桌台"
                value={state.tables
                    .map(item => `${item.table_name ?? item.table_no ?? item.table_id} / ${item.table_type ?? '-'} / ${item.capacity ?? '-'}座`)
                    .join(', ') || '-'}
            />
            <DataRow
                label="工作站"
                value={state.workstations
                    .map(item => `${item.workstation_name ?? item.workstation_code ?? item.workstation_id} / ${item.workstation_type ?? '-'} / ${(item.responsible_categories ?? item.category_codes ?? []).join('|') || '-'}`)
                    .join(', ') || '-'}
            />
        </Section>
        <Section title="店铺级 IAM 预览" subtitle="本轮不做店员登录；这里展示未来登录会使用的店铺级员工、角色和权限资料。">
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10}}>
                <StatusPill tone={state.iamReadiness.readyForFutureLogin ? 'green' : 'amber'}>
                    {state.iamReadiness.readyForFutureLogin ? 'LOGIN DATA READY' : 'LOGIN DATA RESERVED'}
                </StatusPill>
                <StatusPill>Users {state.users.length}</StatusPill>
                <StatusPill>Roles {state.roles.length}</StatusPill>
                <StatusPill>Permissions {state.permissions.length}</StatusPill>
                <StatusPill>Bindings {state.bindings.length}</StatusPill>
            </View>
            {state.users.map(user => (
                <View key={user.user_id} style={{borderRadius: 16, backgroundColor: '#f8fafc', padding: 12}}>
                    <Text style={{fontSize: 15, fontWeight: '900', color: '#0f172a'}}>{user.display_name ?? user.user_id}</Text>
                    <Text style={{fontSize: 12, color: '#64748b', marginTop: 4}}>
                        {user.user_code} · {user.mobile ?? 'no mobile'} · {user.status ?? 'UNKNOWN'}
                    </Text>
                </View>
            ))}
        </Section>
        <Section title="组织树" subtitle="按平台、项目、租户、品牌、门店层级展示。">
            <Text selectable style={{fontFamily: 'Menlo', fontSize: 11, lineHeight: 16, color: '#334155'}}>
                {asJson(state.organizationTree)}
            </Text>
        </Section>
    </View>
)

const ProductDomain: React.FC<{state: ReturnType<typeof useWorkbenchState>}> = ({state}) => (
    <View style={{gap: 16}}>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12}}>
            <MetricCard label="餐饮商品" value={state.productSummary.products} tone="blue" />
            <MetricCard label="商品分类" value={state.productSummary.productCategories} tone="slate" />
            <MetricCard label="品牌菜单" value={state.productSummary.brandMenus} tone="green" />
            <MetricCard label="门店菜单" value={state.productSummary.menuCatalogs} tone="amber" />
            <MetricCard label="渠道映射" value={state.productSummary.channelMappings} tone="slate" />
            <MetricCard label="菜单分区" value={state.menu?.sections.length ?? 0} tone="slate" />
        </View>
        <Section title="商品分类与继承" subtitle="分类和继承关系来自后台主数据，菜单和门店覆盖都应基于这些事实。">
            <DataRow label="分类" value={state.productCategories.map(item => item.category_name ?? item.category_code ?? item.category_id).join(', ') || '-'} />
            <DataRow label="门店继承关系" value={`${state.productInheritances.length} 条`} />
            <DataRow label="渠道商品映射" value={`${state.channelMappings.length} 条`} />
        </Section>
        <Section title="终端有效菜单" subtitle="`menu.catalog` 是终端 authoritative 菜单视图；商品资料只用于补充详情。">
            <DataRow label="菜单" value={state.menu?.menuName ?? state.menu?.menuId} />
            <DataRow label="门店" value={state.menu?.storeId} />
            <DataRow label="版本哈希" value={state.menu?.versionHash} />
            {(state.menu?.sections ?? []).map(section => (
                <View key={section.sectionId} style={{borderRadius: 18, backgroundColor: '#f8fafc', padding: 14, gap: 10}}>
                    <Text style={{fontSize: 15, fontWeight: '900', color: '#0f172a'}}>
                        {section.displayOrder}. {section.sectionName}
                    </Text>
                    {section.products.map(product => (
                        <View key={`${section.sectionId}:${product.productId}`} style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            gap: 12,
                            paddingVertical: 8,
                            borderTopWidth: 1,
                            borderTopColor: '#e2e8f0',
                        }}>
                            <Text style={{fontSize: 13, fontWeight: '800', color: '#1e293b'}}>{product.title}</Text>
                            <Text style={{fontSize: 13, color: '#475569'}}>
                                {product.productType ?? 'PRODUCT'} · {product.categoryId ?? '未分类'} · {product.price == null ? '-' : `¥${product.price}`}
                            </Text>
                        </View>
                    ))}
                </View>
            ))}
        </Section>
        <Section title="商品详情矩阵" subtitle="展示 variants、modifier、combo、production profile 等资料的入口摘要。">
            {state.productDisplay.productCards.map(product => (
                <View key={product.productId} style={{
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    padding: 14,
                    gap: 6,
                }}>
                    <Text style={{fontSize: 15, fontWeight: '900', color: '#0f172a'}}>{product.title}</Text>
                    <Text style={{fontSize: 12, color: '#64748b'}}>
                        {product.productId} · {product.categoryId ?? '未分类'} · {product.type ?? 'STANDARD'} · {product.ownershipScope ?? 'UNKNOWN'} · ¥{product.price ?? '-'}
                    </Text>
                    <Text style={{fontSize: 12, color: '#475569'}}>
                        加料组 {product.modifierGroupCount} · 出品步骤 {product.productionStepCount} · 出品分类 {product.productionCategoryCount} · 在用菜单 {product.menuUsageCount}
                    </Text>
                </View>
            ))}
        </Section>
    </View>
)

const OperationDomain: React.FC<{state: ReturnType<typeof useWorkbenchState>}> = ({state}) => (
    <View style={{gap: 16}}>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12}}>
            <MetricCard label="营业配置" value={state.operationDashboard.storeConfig ? 1 : 0} tone="blue" />
            <MetricCard label="可售项" value={state.operatingStatus.availableItems} tone="green" />
            <MetricCard label="售罄项" value={state.operatingStatus.soldOutItems} tone={state.operatingStatus.soldOutItems > 0 ? 'amber' : 'slate'} />
            <MetricCard label="低库存" value={state.operatingStatus.lowStockItems} tone={state.operatingStatus.lowStockItems > 0 ? 'amber' : 'slate'} />
            <MetricCard label="占用汇总" value={state.operatingStatus.reservedStockQuantity} tone="blue" />
        </View>
        <Section title="门店经营参数" subtitle="`store.config` 承载营业状态、渠道入口、营业时段和附加费等交易前配置，不在此处理订单。">
            <DataRow label="营业状态" value={state.storeConfig?.business_status} />
            <DataRow label="渠道入口策略" value={state.storeConfig?.accept_order === true ? '开放终端渠道入口' : state.storeConfig?.accept_order === false ? '暂停终端渠道入口' : '-'} />
            <DataRow label="营业时段" value={state.operationDashboard.storeConfig?.operatingHoursCount ?? 0} />
            <DataRow label="附加费规则" value={state.operationDashboard.storeConfig?.extraChargeRuleCount ?? 0} />
        </Section>
        <Section title="终端有效可售状态" subtitle="`menu.availability` 是终端 authoritative 可售视图；库存占用只作为主数据事实展示，不在这里执行交易或预订流程。">
            {state.operationDashboard.availabilityRows.map(row => (
                <View key={row.productId} style={{borderRadius: 16, backgroundColor: '#f8fafc', padding: 12}}>
                    <StatusPill tone={row.available ? 'green' : 'red'}>{row.available ? 'AVAILABLE' : 'SOLD OUT'}</StatusPill>
                    <Text style={{marginTop: 8, fontSize: 15, fontWeight: '900', color: '#0f172a'}}>{row.productId}</Text>
                    <Text style={{marginTop: 4, fontSize: 12, color: '#64748b'}}>
                        {row.soldOutReason ?? 'No sold-out reason'} · {row.effectiveFrom ?? '-'}
                    </Text>
                </View>
            ))}
        </Section>
        <Section title="库存与占用汇总" subtitle="展示 saleable stock 的可售、已售、下游占用汇总和安全库存，用于判断终端可售基础事实。">
            {state.operationDashboard.stockRows.map(row => (
                <DataRow
                    key={row.stockId}
                    label={row.productId ?? row.stockId}
                    value={`可售=${row.saleableQuantity}, 占用汇总=${row.reservedQuantity}, 安全库存=${row.safetyStock}, 状态=${row.status ?? '-'}`}
                />
            ))}
        </Section>
    </View>
)

const InspectorDomain: React.FC<{state: ReturnType<typeof useWorkbenchState>}> = ({state}) => (
    <View style={{gap: 16}}>
        <Section title="投影健康" subtitle="按业务包展示最后更新时间和解析诊断，便于联调定位 topic/schema 问题。">
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12}}>
                <MetricCard label="Org/IAM Diagnostics" value={state.organizationDiagnostics.length} tone={state.organizationDiagnostics.length ? 'amber' : 'green'} />
                <MetricCard label="Product Diagnostics" value={state.productDiagnostics.length} tone={state.productDiagnostics.length ? 'amber' : 'green'} />
                <MetricCard label="Operation Diagnostics" value={state.operationDiagnostics.length} tone={state.operationDiagnostics.length ? 'amber' : 'green'} />
            </View>
            <Text selectable style={{fontFamily: 'Menlo', fontSize: 11, lineHeight: 16, color: '#334155'}}>
                {asJson({
                    terminalId: state.identity.terminalId,
                    organization: state.organizationSummary,
                    product: state.productSummary,
                    operation: state.operationSummary,
                    diagnostics: [
                        ...state.organizationDiagnostics,
                        ...state.productDiagnostics,
                        ...state.operationDiagnostics,
                    ],
                })}
            </Text>
        </Section>
        <Section title="原始主数据记录" subtitle="默认业务视图保持清爽；这里保留完整 wire envelope 以便和服务端设计文档对照。">
            <Text selectable style={{fontFamily: 'Menlo', fontSize: 11, lineHeight: 16, color: '#334155'}}>
                {asJson(state.rawOrganizationRecords)}
            </Text>
        </Section>
    </View>
)

const useWorkbenchState = () => {
    const identity = useSelector((state: RootState) => selectTcpIdentitySnapshot(state))
    const organizationSummary = useSelector(selectOrganizationIamSummary)
    const productSummary = useSelector(selectCateringProductSummary)
    const operationSummary = useSelector(selectCateringStoreOperatingSummary)
    const platform = useSelector(selectCurrentPlatformProfile)
    const project = useSelector(selectCurrentProjectProfile)
    const region = useSelector(selectCurrentRegionProfile)
    const tenant = useSelector(selectCurrentTenantProfile)
    const brand = useSelector(selectCurrentBrandProfile)
    const store = useSelector(selectCurrentStoreProfile)
    const contract = useSelector(selectCurrentActiveContract)
    const users = useSelector(selectStoreEffectiveUsers)
    const roles = useSelector(selectStoreEffectiveRoles)
    const permissions = useSelector(selectStoreEffectivePermissions)
    const bindings = useSelector(selectStoreEffectiveUserRoleBindings)
    const businessEntities = useSelector(selectCurrentTenantBusinessEntities)
    const tables = useSelector(selectCurrentStoreTables)
    const workstations = useSelector(selectCurrentStoreWorkstations)
    const iamReadiness = useSelector(selectIamReadinessSummary)
    const organizationTree = useSelector(selectOrganizationTree)
    const menu = useSelector(selectCurrentStoreEffectiveMenu)
    const latestProduct = useSelector(selectLatestCateringProduct)
    const productCategories = useSelector(selectAllProductCategories)
    const productInheritances = useSelector(selectAllProductInheritances)
    const channelMappings = useSelector(selectAllChannelProductMappings)
    const products = useSelector(selectAllCateringProducts)
    const productDisplay = useSelector(selectCateringProductDisplayModel)
    const storeConfig = useSelector(selectCurrentStoreConfig)
    const operatingStatus = useSelector(selectStoreOperatingStatus)
    const operationDashboard = useSelector(selectOperationDashboardModel)
    const organizationDiagnostics = useSelector(selectOrganizationIamDiagnostics)
    const productDiagnostics = useSelector(selectCateringProductDiagnostics)
    const operationDiagnostics = useSelector(selectCateringStoreOperatingDiagnostics)
    const rawOrganizationRecords = useSelector(selectOrganizationIamAllRecords)

    return {
        identity,
        organizationSummary,
        productSummary,
        operationSummary,
        platform,
        project,
        region,
        tenant,
        brand,
        store,
        contract,
        users,
        roles,
        permissions,
        bindings,
        businessEntities,
        tables,
        workstations,
        iamReadiness,
        organizationTree,
        menu,
        latestProduct,
        productCategories,
        productInheritances,
        channelMappings,
        products,
        productDisplay,
        storeConfig,
        operatingStatus,
        operationDashboard,
        organizationDiagnostics,
        productDiagnostics,
        operationDiagnostics,
        rawOrganizationRecords,
    }
}

export const MasterDataWorkbenchScreen: React.FC<MasterDataWorkbenchScreenProps> = ({
    terminalId,
}) => {
    const runtime = useUiRuntime()
    const automationBridge = useOptionalUiAutomationBridge()
    const automationRuntimeId = useOptionalUiAutomationRuntimeId() ?? runtime.runtimeId
    const automationTarget = useOptionalUiAutomationTarget() ?? 'primary'
    const state = useWorkbenchState()
    const displayMode = useSelector((rootState: RootState) => selectTopologyDisplayMode(rootState) ?? 'PRIMARY')
    const [domain, setDomain] = useState<DomainKey>('organization')
    const screenKey = displayMode === 'SECONDARY'
        ? 'ui.business.catering-master-data-workbench.secondary-workbench'
        : 'ui.business.catering-master-data-workbench.primary-workbench'
    const resolvedTerminalId = terminalId ?? state.identity.terminalId ?? 'terminal:activated'
    const displayTitle = displayMode === 'SECONDARY'
        ? '餐饮主数据工作台 · SECONDARY'
        : '餐饮主数据工作台 · PRIMARY'
    const liveMenu = state.menu
    const liveProduct = state.latestProduct

    useEffect(() => {
        if (!automationBridge) {
            return undefined
        }
        const unregisters = [
            automationBridge.registerNode({
                target: automationTarget,
                runtimeId: automationRuntimeId,
                screenKey,
                mountId: `${screenKey}:root`,
                nodeId: 'ui-business-catering-master-data-workbench:root',
                testID: 'ui-business-catering-master-data-workbench:root',
                semanticId: 'ui-business-catering-master-data-workbench:root',
                role: 'screen',
                text: displayTitle,
                visible: true,
                enabled: true,
                availableActions: [],
            }),
            automationBridge.registerNode({
                target: automationTarget,
                runtimeId: automationRuntimeId,
                screenKey,
                mountId: `${screenKey}:title`,
                nodeId: 'ui-business-catering-master-data-workbench:title',
                testID: 'ui-business-catering-master-data-workbench:title',
                semanticId: 'ui-business-catering-master-data-workbench:title',
                role: 'heading',
                text: displayTitle,
                value: displayMode,
                visible: true,
                enabled: true,
                availableActions: [],
            }),
            automationBridge.registerNode({
                target: automationTarget,
                runtimeId: automationRuntimeId,
                screenKey,
                mountId: `${screenKey}:terminal-id`,
                nodeId: 'ui-business-catering-master-data-workbench:terminal-id',
                testID: 'ui-business-catering-master-data-workbench:terminal-id',
                semanticId: 'ui-business-catering-master-data-workbench:terminal-id',
                role: 'text',
                text: resolvedTerminalId,
                value: resolvedTerminalId,
                visible: true,
                enabled: true,
                availableActions: [],
            }),
            automationBridge.registerNode({
                target: automationTarget,
                runtimeId: automationRuntimeId,
                screenKey,
                mountId: `${screenKey}:live-product-name`,
                nodeId: 'ui-business-catering-master-data-workbench:live-product-name',
                testID: 'ui-business-catering-master-data-workbench:live-product-name',
                semanticId: 'ui-business-catering-master-data-workbench:live-product-name',
                role: 'text',
                text: liveProduct?.product_name ?? '-',
                value: liveProduct?.product_id ?? '-',
                visible: true,
                enabled: true,
                availableActions: [],
            }),
            automationBridge.registerNode({
                target: automationTarget,
                runtimeId: automationRuntimeId,
                screenKey,
                mountId: `${screenKey}:live-product-price`,
                nodeId: 'ui-business-catering-master-data-workbench:live-product-price',
                testID: 'ui-business-catering-master-data-workbench:live-product-price',
                semanticId: 'ui-business-catering-master-data-workbench:live-product-price',
                role: 'text',
                text: liveProduct?.base_price == null ? '-' : `¥${liveProduct.base_price}`,
                value: liveProduct?.base_price == null ? '-' : String(liveProduct.base_price),
                visible: true,
                enabled: true,
                availableActions: [],
            }),
            automationBridge.registerNode({
                target: automationTarget,
                runtimeId: automationRuntimeId,
                screenKey,
                mountId: `${screenKey}:live-menu-name`,
                nodeId: 'ui-business-catering-master-data-workbench:live-menu-name',
                testID: 'ui-business-catering-master-data-workbench:live-menu-name',
                semanticId: 'ui-business-catering-master-data-workbench:live-menu-name',
                role: 'text',
                text: liveMenu?.menuName ?? '-',
                value: liveMenu?.menuId ?? '-',
                visible: true,
                enabled: true,
                availableActions: [],
            }),
        ]
        return () => unregisters.forEach(unregister => unregister())
    }, [
        automationBridge,
        automationRuntimeId,
        automationTarget,
        displayTitle,
        displayMode,
        liveMenu?.menuId,
        liveMenu?.menuName,
        liveProduct?.base_price,
        liveProduct?.product_id,
        liveProduct?.product_name,
        resolvedTerminalId,
        screenKey,
    ])

    const content = domain === 'organization'
        ? <OrganizationDomain state={state} />
        : domain === 'product'
            ? <ProductDomain state={state} />
            : domain === 'operation'
                ? <OperationDomain state={state} />
                : <InspectorDomain state={state} />

    return (
        <View
            testID="ui-business-catering-master-data-workbench:root"
            style={{
                flex: 1,
                backgroundColor: '#e8eef4',
            }}
        >
            <View style={{
                paddingHorizontal: 22,
                paddingVertical: 16,
                backgroundColor: '#0f172a',
                borderBottomWidth: 1,
                borderBottomColor: '#1e293b',
            }}>
                <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16}}>
                    <View style={{gap: 4, flex: 1}}>
                        <Text style={{fontSize: 12, fontWeight: '900', color: '#38bdf8'}}>主数据工作台</Text>
                        <Text
                            style={{fontSize: 26, lineHeight: 32, fontWeight: '900', color: '#f8fafc'}}
                            testID="ui-business-catering-master-data-workbench:title"
                        >
                            {displayTitle}
                        </Text>
                        <Text style={{fontSize: 12, color: '#cbd5e1'}} testID="ui-business-catering-master-data-workbench:terminal-id">
                            终端 {resolvedTerminalId} · {displayMode} · 仅终端激活链路 · 当前不要求店员登录
                        </Text>
                    </View>
                    <View style={{flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8}}>
                        <StatusPill tone="green">主数据投射已连接</StatusPill>
                        <StatusPill tone="blue">{displayMode}</StatusPill>
                    </View>
                </View>
            </View>

            <View style={{flexDirection: 'row', flex: 1, minHeight: 0}}>
                <View style={{
                    width: 190,
                    padding: 16,
                    gap: 10,
                    backgroundColor: '#f8fafc',
                    borderRightWidth: 1,
                    borderRightColor: '#dbe4ef',
                }}>
                    {(Object.keys(domainLabels) as DomainKey[]).map(key => {
                        const selected = domain === key
                        return (
                            <Text
                                key={key}
                                testID={`ui-business-catering-master-data-workbench:domain:${key}`}
                                onPress={() => setDomain(key)}
                                style={{
                                    borderRadius: 16,
                                    overflow: 'hidden',
                                    paddingHorizontal: 14,
                                    paddingVertical: 12,
                                    fontSize: 14,
                                    fontWeight: '900',
                                    backgroundColor: selected ? '#0f172a' : '#ffffff',
                                    color: selected ? '#f8fafc' : '#334155',
                                    borderWidth: 1,
                                    borderColor: selected ? '#0f172a' : '#dbe4ef',
                                }}
                            >
                                {domainLabels[key]}
                            </Text>
                        )
                    })}
                    <View style={{marginTop: 10, gap: 8}}>
                        <Text style={{fontSize: 11, fontWeight: '900', color: '#64748b'}}>实时摘要</Text>
                        <Text style={{fontSize: 12, color: '#475569', lineHeight: 18}}>
                            组织 {state.organizationSummary.stores} 家门店 · 菜单 {state.productSummary.menuCatalogs} 份 · 库存 {state.operationSummary.stocks} 条
                        </Text>
                    </View>
                </View>

                <ScrollView
                    testID="ui-business-catering-master-data-workbench:content"
                    style={{flex: 1}}
                    contentContainerStyle={{
                        padding: 20,
                        gap: 16,
                    }}
                >
                    {content}
                </ScrollView>
            </View>
        </View>
    )
}
