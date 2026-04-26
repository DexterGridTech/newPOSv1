import {EnvironmentWorkspace} from './workspaces/EnvironmentWorkspace'
import {FacilitiesWorkspace} from './workspaces/FacilitiesWorkspace'
import {IamWorkspace} from './workspaces/IamWorkspace'
import {MenusWorkspace} from './workspaces/MenusWorkspace'
import {OperationsWorkspace} from './workspaces/OperationsWorkspace'
import {OrganizationWorkspace} from './workspaces/OrganizationWorkspace'
import {ProductsWorkspace} from './workspaces/ProductsWorkspace'
import {ProjectionWorkspace} from './workspaces/ProjectionWorkspace'
import type {DomainKey} from './types'
import type {useAdminConsoleState} from './useAdminConsoleState'

type AdminConsoleState = ReturnType<typeof useAdminConsoleState>

type Props = {
  activeDomain: DomainKey
  state: AdminConsoleState
}

export function WorkspaceRouter({activeDomain, state}: Props) {
  switch (activeDomain) {
    case 'environment':
      return (
        <EnvironmentWorkspace
          sandboxes={state.sandboxes}
          platforms={state.platforms}
          projects={state.projects}
          documents={state.documents}
          outbox={state.outbox}
          authCapabilities={state.authCapabilities}
          environmentDraft={state.environmentDraft}
          setEnvironmentDraft={state.setEnvironmentDraft}
          environmentActionLoading={state.environmentActionLoading}
          lastEnvironmentResult={state.lastEnvironmentResult}
          environmentSummary={state.environmentSummary}
          pendingCount={state.pendingCount}
          runEnvironmentSetup={state.runEnvironmentSetup}
          cycleEnvironmentLifecycle={state.cycleEnvironmentLifecycle}
          applyDemoChange={state.applyDemoChange}
          rebuildOutbox={state.rebuildOutbox}
        />
      )
    case 'organization':
      return (
        <OrganizationWorkspace
          stores={state.stores}
          orgDraft={state.orgDraft}
          setOrgDraft={state.setOrgDraft}
          orgActionLoading={state.orgActionLoading}
          runOrganizationFlow={state.runOrganizationFlow}
          suspendTenant={state.suspendTenant}
          contractLifecycleDraft={state.contractLifecycleDraft}
          setContractLifecycleDraft={state.setContractLifecycleDraft}
          amendLatestContract={state.amendLatestContract}
          renewLatestContract={state.renewLatestContract}
          terminateLatestContract={state.terminateLatestContract}
          lastOrganizationResult={state.lastOrganizationResult}
          orgTree={state.orgTree}
          platforms={state.platforms}
          projects={state.projects}
          tenants={state.tenants}
          brands={state.brands}
          contracts={state.contracts}
          businessEntities={state.businessEntities}
          selectedTenantId={state.selectedTenantId}
          selectTenantContext={state.selectTenantContext}
          selectedStoreId={state.selectedStoreId}
          selectStoreContext={state.selectStoreContext}
          selectedTenant={state.selectedTenant}
          selectedStore={state.selectedStore}
          tenantStores={state.tenantStores}
          storeContractMonitor={state.storeContractMonitor}
          lastContractLifecycleResult={state.lastContractLifecycleResult}
          storeSnapshots={state.storeSnapshots}
        />
      )
    case 'facilities':
      return (
        <FacilitiesWorkspace
          tables={state.tables}
          workstations={state.workstations}
        />
      )
    case 'iam':
      return (
        <IamWorkspace
          users={state.users}
          permissions={state.permissions}
          roles={state.roles}
          userRoleBindings={state.userRoleBindings}
          storeEffectiveIam={state.storeEffectiveIam}
          userEffectivePermissions={state.userEffectivePermissions}
          iamDraft={state.iamDraft}
          setIamDraft={state.setIamDraft}
          iamActionLoading={state.iamActionLoading}
          runIamWorkflow={state.runIamWorkflow}
          runIamPermissionCheck={state.runIamPermissionCheck}
          changeIamUserStatus={state.changeIamUserStatus}
          changeIamRoleStatus={state.changeIamRoleStatus}
          revokeLatestIamBinding={state.revokeLatestIamBinding}
          authCapabilities={state.authCapabilities}
          lastIamResult={state.lastIamResult}
        />
      )
    case 'products':
      return (
        <ProductsWorkspace
          products={state.products}
          productDraft={state.productDraft}
          setProductDraft={state.setProductDraft}
          productActionLoading={state.productActionLoading}
          upsertProductFlow={state.upsertProductFlow}
          changeLatestProductStatus={state.changeLatestProductStatus}
          lastProductResult={state.lastProductResult}
        />
      )
    case 'menus':
      return (
        <MenusWorkspace
          menus={state.menus}
          storeMenus={state.storeMenus}
          menuDraft={state.menuDraft}
          setMenuDraft={state.setMenuDraft}
          menuActionLoading={state.menuActionLoading}
          runMenuWorkflow={state.runMenuWorkflow}
          rejectLatestMenu={state.rejectLatestMenu}
          rollbackLatestStoreMenu={state.rollbackLatestStoreMenu}
          lastMenuResult={state.lastMenuResult}
        />
      )
    case 'operations':
      return (
        <OperationsWorkspace
          storeConfigs={state.storeConfigs}
          inventories={state.inventories}
          priceRules={state.priceRules}
          availabilityRules={state.availabilityRules}
          menuAvailability={state.menuAvailability}
          operationDraft={state.operationDraft}
          setOperationDraft={state.setOperationDraft}
          operationActionLoading={state.operationActionLoading}
          runOperationsWorkflow={state.runOperationsWorkflow}
          restoreProductAvailability={state.restoreProductAvailability}
          lastOperationResult={state.lastOperationResult}
        />
      )
    case 'projection':
      return (
        <ProjectionWorkspace
          auditEvents={state.auditEvents}
          outbox={state.outbox}
          diagnostics={state.diagnostics}
          preview={state.preview}
          previewPublish={state.previewPublish}
          publish={state.publish}
          retry={state.retry}
          pendingCount={state.pendingCount}
          failedCount={state.failedCount}
        />
      )
    default:
      return null
  }
}
