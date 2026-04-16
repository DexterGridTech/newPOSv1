package com.impos2.mixcretailassemblyrn84

import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.impos2.adapterv2.appcontrol.AppControlManager
import com.impos2.mixcretailassemblyrn84.restart.AppRestartManager
import com.impos2.mixcretailassemblyrn84.startup.LaunchOptionsFactory
import com.impos2.mixcretailassemblyrn84.startup.SecondaryDisplayLauncher
import com.impos2.mixcretailassemblyrn84.startup.StartupAuditLogger
import com.impos2.mixcretailassemblyrn84.startup.StartupCoordinator
import com.impos2.mixcretailassemblyrn84.startup.StartupOverlayManager
import com.impos2.mixcretailassemblyrn84.turbomodules.ConnectorTurboModule

/**
 * 主屏 Activity。
 *
 * 它承担的是“主进程宿主”的角色，而不只是一个普通 RN 页面容器：
 * - 负责承载主屏 RN 应用；
 * - 负责初始化启动编排器；
 * - 负责在主屏 ready 后按时序拉起副屏；
 * - 负责接受 JS 发起的全局重启请求；
 * - 负责把宿主按键事件转交给 Connector；
 * - 负责在生命周期中反复重放全屏 / 锁定等系统 UI 状态。
 */
class MainActivity : ReactActivity() {

  companion object {
    private const val TAG = "MainActivity"

    /**
     * 主屏 Activity 的当前实例。
     *
     * 多处原生桥接逻辑需要以主屏为控制中心，例如：
     * - AppControl 的 restartApp；
     * - 启动阶段的遮罩控制；
     * - 副屏启动状态回报。
     *
     * 这里用 `@Volatile` 保证跨线程读取时可见，避免拿到过期引用。
     */
    @Volatile
    var instance: MainActivity? = null
      private set
  }

  /**
   * 负责执行“先停 webserver、再请求副屏退出、最后 reload 主屏 runtime”的重启编排器。
   */
  private lateinit var appRestartManager: AppRestartManager

  /**
   * 负责把副屏 Activity 拉到第二块屏幕上的启动器。
   *
   * 注意它只关心“怎么启动副屏”，不关心“何时启动副屏”；启动时机由 [StartupCoordinator]
   * 统一控制。
   */
  private lateinit var secondaryDisplayLauncher: SecondaryDisplayLauncher

  /**
   * adapterPure 中的系统控制能力入口。
   *
   * 主屏启动后需要立即设为全屏，并在生命周期变化时不断重放状态，否则某些 ROM、某些系统栏
   * 交互场景下全屏状态会丢失。
   */
  private val appControlManager by lazy {
    AppControlManager.getInstance(application)
  }

  /**
   * 返回注册到 `AppRegistry` 的 RN 根组件名。
   */
  override fun getMainComponentName(): String = "MixcRetailAssemblyRN84"

  /**
   * 创建 ReactActivityDelegate。
   *
   * 这里最关键的是向 JS 传递启动参数：主屏固定传 `displayIndex = 0`，让上层业务能明确区分
   * 当前 runtime 属于主屏环境。
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
    object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
      override fun getLaunchOptions(): Bundle = LaunchOptionsFactory.create(this@MainActivity, 0)
    }

  /**
   * 主屏创建入口。
   *
   * 执行顺序很重要：
   * 1. 安装系统 Splash；
   * 2. 记录当前实例和审计日志；
   * 3. 进入 RN 生命周期；
   * 4. 初始化副屏启动器和重启管理器；
   * 5. 立即应用全屏并重放状态；
   * 6. 挂接启动编排器，显示原生启动遮罩。
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    installSplashScreen()
    instance = this
    StartupAuditLogger.logActivityCreated("MainActivity", 0)
    super.onCreate(savedInstanceState)
    secondaryDisplayLauncher = SecondaryDisplayLauncher(this)
    appRestartManager = AppRestartManager(this)
    runCatching { appControlManager.setFullscreen(true) }
      .onFailure { Log.e(TAG, "Failed to enable fullscreen on create", it) }
    runCatching { appControlManager.reapplyCurrentState() }
      .onFailure { Log.e(TAG, "Failed to reapply app control state on create", it) }
    runCatching { StartupCoordinator.attachPrimary(this) }
      .onFailure { Log.e(TAG, "Failed to attach startup coordinator", it) }
  }

  /**
   * 销毁时移除启动遮罩，并清掉全局实例引用，避免后续重启时持有已失效 Activity。
   */
  override fun onDestroy() {
    StartupOverlayManager.detach(this)
    if (instance === this) {
      instance = null
    }
    super.onDestroy()
  }

  /**
   * Activity 回到前台时重放系统 UI 状态。
   *
   * 一些 ROM 会在页面切换、对话框弹出、权限页返回后清掉全屏标记，所以这里要重复应用。
   */
  override fun onResume() {
    super.onResume()
    runCatching { appControlManager.reapplyCurrentState() }
      .onFailure { Log.e(TAG, "Failed to reapply app control state on resume", it) }
  }

  /**
   * 获取窗口焦点后再次重放系统 UI 状态。
   *
   * 这是对 [onResume] 的补偿，处理“Activity 已恢复但 DecorView 重新布局后全屏被系统回滚”
   * 的情况。
   */
  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      runCatching { appControlManager.reapplyCurrentState() }
        .onFailure { Log.e(TAG, "Failed to reapply app control state on window focus", it) }
    }
  }

  /**
   * 供 JS 发起应用级重启。
   *
   * 真正的复杂逻辑不放在 Activity 中堆叠，而是下沉到 [AppRestartManager]。
   */
  fun restartApp() {
    appRestartManager.restart()
  }

  /**
   * 触发主进程 ReactHost 重载。
   *
   * 这是“重启”中真正让主屏 JS runtime 被重新创建的动作。副屏不会直接调用它，避免副屏反向
   * 控制主进程宿主。
   */
  fun reloadReactHostForRestart() {
    StartupAuditLogger.logMainReload()
    reactHost.reload("user restart")
  }

  /**
   * 尝试在第二块屏幕上拉起副屏 Activity。
   */
  fun launchSecondaryIfAvailable() {
    secondaryDisplayLauncher.startIfAvailable()
  }

  /**
   * 副屏 Activity 创建成功后回报主屏，更新启动器内部状态。
   */
  fun onSecondaryActivityCreated() {
    secondaryDisplayLauncher.markSecondaryStarted()
  }

  /**
   * 副屏 Activity 销毁后回报主屏，更新启动器内部状态。
   */
  fun onSecondaryActivityDestroyed() {
    secondaryDisplayLauncher.markSecondaryStopped()
  }

  /**
   * 在新一轮启动或重启开始前，清空副屏启动器内部的“已启动”标记。
   */
  fun resetSecondaryLaunchState() {
    secondaryDisplayLauncher.reset()
  }

  /**
   * 当前是否存在副屏实例或副屏正在启动中。
   */
  val isSecondaryDisplayActive: Boolean
    get() = secondaryDisplayLauncher.isSecondaryActive

  /**
   * 将宿主按键事件转发给 Connector。
   *
   * 一些外设或硬件扫描输入并不经过普通 RN 文本输入框，而是以系统按键形式到达 Activity。
   * 这里先给 Connector 一个消费机会，如果它返回 true，则不再继续走默认分发。
   */
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (ConnectorTurboModule.onHostKeyEvent(event)) {
      return true
    }
    return super.dispatchKeyEvent(event)
  }
}
