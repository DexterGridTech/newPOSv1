export {
    createUiAlertDefinition,
    createUiAlertScreen,
    createUiModalScreen,
    createUiOverlayScreen,
    defaultUiAlertPartKey,
} from '../foundations/screenFactory'

/**
 * 设计意图：
 * supports 暴露的是业务侧更顺手的屏幕构造 helper，避免业务包直接拼 overlay/modal/alert 的协议字段。
 * 真正的协议定义仍在 foundations，helper 不能引入 React 或 UI 组件实现。
 */
