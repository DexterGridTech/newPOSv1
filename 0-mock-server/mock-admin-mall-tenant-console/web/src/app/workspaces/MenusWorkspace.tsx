import type {Dispatch, SetStateAction} from 'react'
import {JsonPanel, ResourceCard, TextField} from '../shared'
import type {EntityItem, LastMenuResult, MenuDraft} from '../types'

type Props = {
  menus: EntityItem[]
  storeMenus: EntityItem[]
  menuDraft: MenuDraft
  setMenuDraft: Dispatch<SetStateAction<MenuDraft>>
  menuActionLoading: boolean
  runMenuWorkflow: () => Promise<void>
  rejectLatestMenu: () => Promise<void>
  rollbackLatestStoreMenu: () => Promise<void>
  lastMenuResult: LastMenuResult | null
}

export function MenusWorkspace(props: Props) {
  const {
    menus,
    storeMenus,
    menuDraft,
    setMenuDraft,
    menuActionLoading,
    runMenuWorkflow,
    rejectLatestMenu,
    rollbackLatestStoreMenu,
    lastMenuResult,
  } = props

  return (
    <>
      <article className="panel workspace-hero-card">
        <div className="panel-title">
          <div>
            <h3>品牌菜单审核与门店发布工作台</h3>
            <p className="panel-subtitle">把品牌源菜单、审核状态机和门店有效菜单发布收成一条连续工作流，再验证 rollback 版本切换。</p>
          </div>
          <span>{menus.length + storeMenus.length} menus</span>
        </div>
        <div className="org-form-grid compact">
          <TextField label="Brand Id" name="menuBrandId" value={menuDraft.brandId} onChange={value => setMenuDraft(current => ({...current, brandId: value}))} />
          <TextField label="Store Id" name="menuStoreId" value={menuDraft.storeId} onChange={value => setMenuDraft(current => ({...current, storeId: value}))} />
          <TextField label="品牌菜单名" name="brandMenuName" value={menuDraft.menuName} onChange={value => setMenuDraft(current => ({...current, menuName: value}))} />
          <TextField label="Section 名称" name="menuSectionName" value={menuDraft.sectionName} onChange={value => setMenuDraft(current => ({...current, sectionName: value}))} />
          <TextField label="门店有效菜单名" name="storeMenuName" value={menuDraft.storeMenuName} onChange={value => setMenuDraft(current => ({...current, storeMenuName: value}))} />
        </div>
        <div className="hero-actions">
          <button className="primary" onClick={() => void runMenuWorkflow()} disabled={menuActionLoading}>创建菜单并审核发布</button>
          <button onClick={() => void rejectLatestMenu()} disabled={menuActionLoading}>驳回最近品牌菜单</button>
          <button onClick={() => void rollbackLatestStoreMenu()} disabled={menuActionLoading}>回滚最近门店菜单</button>
        </div>
      </article>
      <ResourceCard title="品牌菜单" count={menus.length} items={menus} />
      <ResourceCard title="门店菜单" count={storeMenus.length} items={storeMenus} />
      <article className="panel detail-panel">
        <div className="panel-title">
          <div>
            <h3>菜单 source/effective 对照</h3>
            <p className="panel-subtitle">`catering.brand-menu.profile` 保留溯源，`menu.catalog` 才是 terminal effective authority。</p>
          </div>
          <span>{menus.length + storeMenus.length}</span>
        </div>
        <JsonPanel value={{brandMenus: menus, storeMenus}} />
      </article>
      <article className="panel detail-panel">
        <div className="panel-title">
          <div>
            <h3>最近一次菜单工作流结果</h3>
            <p className="panel-subtitle">这里保留品牌菜单审核与门店菜单发布/回滚的最新响应，方便核对 review_status 和 version_hash。</p>
          </div>
          <span>{lastMenuResult ? 'ready' : 'empty'}</span>
        </div>
        <JsonPanel value={lastMenuResult} />
      </article>
    </>
  )
}
