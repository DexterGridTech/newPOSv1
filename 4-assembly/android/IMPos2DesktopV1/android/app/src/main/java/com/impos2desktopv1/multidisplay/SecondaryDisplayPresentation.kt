package com.impos2desktopv1.multidisplay

import android.app.Presentation
import android.content.Context
import android.os.Bundle
import android.util.Log
import android.view.Display
import android.view.ViewGroup
import android.view.WindowManager
import com.facebook.react.ReactInstanceManager
import com.facebook.react.ReactRootView
import com.facebook.react.modules.core.DefaultHardwareBackBtnHandler

/**
 * 副屏显示的Presentation
 * 使用独立的ReactInstanceManager，与主屏加载相同的JS Bundle
 */
class SecondaryDisplayPresentation(
    context: Context,
    private val secondaryDisplay: Display,
    private val reactInstanceManager: ReactInstanceManager,
    private val config: MultiDisplayConfig
) : Presentation(context, secondaryDisplay), DefaultHardwareBackBtnHandler {

    companion object {
        private const val TAG = "SecondaryDisplay"
    }

    private var reactRootView: ReactRootView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        Log.d(TAG, "========== 副屏 onCreate 开始 ==========")
        Log.d(TAG, "Display ID: ${secondaryDisplay.displayId}")
        Log.d(TAG, "Display Name: ${secondaryDisplay.name}")
        Log.d(TAG, "Display Size: ${secondaryDisplay.mode.physicalWidth}x${secondaryDisplay.mode.physicalHeight}")

        try {
            // 配置窗口属性
            window?.apply {
                Log.d(TAG, "配置窗口属性...")
                setLayout(
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.MATCH_PARENT
                )
                Log.d(TAG, "窗口布局已设置为 MATCH_PARENT")

                // 根据配置决定是否保持屏幕常亮
                if (config.keepScreenOn) {
                    decorView.keepScreenOn = true
                    Log.d(TAG, "屏幕常亮已启用")
                }
            }

            // 创建ReactRootView
            Log.d(TAG, "创建 ReactRootView...")
            val rootView = ReactRootView(context).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
            }
            reactRootView = rootView
            Log.d(TAG, "ReactRootView 创建成功")

            setContentView(rootView)
            Log.d(TAG, "ReactRootView 已设置为 ContentView")

            // 传递初始化参数
            val initialProps = Bundle().apply {
                putString("screenType", "secondary")
                putInt("displayId", secondaryDisplay.displayId)
                putString("displayName", secondaryDisplay.name ?: "Secondary Display")
            }

            Log.d(TAG, "初始化参数:")
            Log.d(TAG, "  - screenType: secondary")
            Log.d(TAG, "  - displayId: ${secondaryDisplay.displayId}")
            Log.d(TAG, "  - displayName: ${secondaryDisplay.name}")
            Log.d(TAG, "组件名称: ${config.secondaryScreenComponent}")

            // 启动React应用（使用与主屏相同的组件名和Bundle）
            Log.d(TAG, "🚀 启动React应用...")
            rootView.startReactApplication(
                reactInstanceManager,
                config.secondaryScreenComponent,
                initialProps
            )

            Log.d(TAG, "✅ startReactApplication() 调用完成")
            Log.d(TAG, "========== 副屏 onCreate 完成 ==========")
        } catch (e: Exception) {
            Log.e(TAG, "========== 副屏 onCreate 失败 ==========", e)
            handleError(e)
        }
    }

    override fun onStart() {
        super.onStart()
        Log.d(TAG, "========== 副屏 onStart ==========")
        Log.d(TAG, "Presentation 已启动")
        Log.d(TAG, "Window: ${window}")
        Log.d(TAG, "isShowing: ${isShowing}")
    }

    override fun onStop() {
        super.onStop()
        Log.d(TAG, "========== 副屏 onStop ==========")
        try {
            reactRootView?.unmountReactApplication()
            Log.d(TAG, "ReactRootView 已卸载")
        } catch (e: Exception) {
            Log.e(TAG, "卸载 ReactRootView 失败", e)
            handleError(e)
        }
    }

    override fun invokeDefaultOnBackPressed() {
        // 处理返回键
    }

    /**
     * 处理副屏错误
     */
    private fun handleError(e: Exception) {
        if (config.errorHandling.catchSecondaryScreenErrors) {
            Log.e(TAG, "副屏发生错误，但不影响主屏运行", e)
        } else {
            throw e
        }
    }
}
