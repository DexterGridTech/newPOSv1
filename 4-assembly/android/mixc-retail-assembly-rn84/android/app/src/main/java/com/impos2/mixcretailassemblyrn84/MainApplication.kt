package com.impos2.mixcretailassemblyrn84

import android.app.Application
import android.os.Process
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.devsupport.interfaces.DevLoadingViewManager
import com.impos2.mixcretailassemblyrn84.turbomodules.AdapterPackage
import java.io.File

/**
 * 应用级入口。
 *
 * 这个类只负责两件事情：
 * 1. 初始化 RN 0.84 新架构运行时；
 * 2. 注册整合层自己的 TurboModule 包，让 JS 能通过 Codegen 规范访问原生能力。
 *
 * 当前工程采用双进程双 JS 运行时模型：
 * - 主进程会创建一套 [ReactHost]；
 * - 副进程也会创建自己独立的一套 [ReactHost]。
 *
 * 因为 Android 多进程会为每个进程各自实例化一次 [Application]，所以这里声明的
 * [reactNativeHost] / [reactHost] 虽然只有一份代码，但运行时会在主进程和副进程中
 * 分别拥有独立实例。这样可以满足后续热更新、双屏独立重建等要求。
 */
class MainApplication : Application(), ReactApplication {

  companion object {
    /**
     * 统一日志标签。
     *
     * 这里只用于开发态日志输出，帮助判断 RN Dev Loading 进度和应用启动顺序。
     */
    private const val TAG = "MainApplication"
  }

  /**
   * RN 传统宿主配置对象。
   *
   * 虽然 RN 0.84 推荐更多围绕 [ReactHost] 工作，但很多底层配置仍然通过
   * [DefaultReactNativeHost] 暴露出来，例如：
   * - 包列表
   * - JS 入口
   * - 开发支持开关
   * - 开发态加载提示处理器
   */
  override val reactNativeHost: DefaultReactNativeHost =
    object : DefaultReactNativeHost(this) {
      /**
       * 返回 RN 可见的 Native Package 列表。
       *
       * 这里保留自动链接产生的默认列表，同时手动追加 assembly 自己的 [AdapterPackage]。
       * [AdapterPackage] 只负责把 RN84 宿主需要的桥接模块暴露给 JS，不承载 adapter / domain 业务编排。
       */
      override fun getPackages() =
        PackageList(this@MainApplication).packages.apply {
          add(AdapterPackage())
        }

      /**
       * 指定 Metro / bundle 的 JS 入口。
       *
       * 当前工程使用标准的 `index` 作为 RN 启动入口，方便与 RN CLI、Metro、Codegen
       * 约定保持一致。
       */
      override fun getJSMainModuleName(): String = "index"

      override fun getJSBundleFile(): String? {
        if (BuildConfig.ENABLE_HOT_UPDATE_BUNDLE_RESOLVER) {
          val isPrimaryProcess = !currentProcessName().endsWith(":secondary")
          val resolvedBundle = HotUpdateBundleResolver(this@MainApplication).resolveBundleFile(
            isPrimaryProcess = isPrimaryProcess,
          )
          val fallbackBundle = super.getJSBundleFile()
          val bundleFile = resolvedBundle ?: fallbackBundle
          Log.i(
            TAG,
            "getJSBundleFile process=${currentProcessName()} isPrimaryProcess=$isPrimaryProcess resolvedBundle=$resolvedBundle fallbackBundle=$fallbackBundle selectedBundle=$bundleFile",
          )
          return bundleFile
        }
        return super.getJSBundleFile()
      }

      /**
       * 是否启用开发支持。
       *
       * 仅在 debug 构建中打开，避免 release 包暴露 DevMenu、Debugger 等开发能力。
       */
      override fun getUseDeveloperSupport(): Boolean =
        BuildConfig.DEBUG && !BuildConfig.ENABLE_HOT_UPDATE_BUNDLE_RESOLVER

      /**
       * 自定义开发态 loading 提示的接收器。
       *
       * 这里不直接弹系统 UI，而是简单打印日志。这样可以避免：
       * - 与自定义启动遮罩叠加导致视觉混乱；
       * - 多进程场景下开发提示窗口互相打架；
       * - 在整合层迁移阶段出现额外的 UI 干扰。
       */
      @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
      override fun getDevLoadingViewManager(): DevLoadingViewManager =
        object : DevLoadingViewManager {
          override fun showMessage(message: String) {
            Log.d(TAG, "RN dev loading: $message")
          }

          override fun showMessage(
            message: String,
            color: Double?,
            backgroundColor: Double?,
            dismissButton: Boolean?,
          ) {
            Log.d(
              TAG,
              "RN dev loading: $message color=$color background=$backgroundColor dismiss=$dismissButton",
            )
          }

          override fun updateProgress(status: String?, done: Int?, total: Int?) {
            Log.d(TAG, "RN dev progress: status=$status done=$done total=$total")
          }

          override fun hide() {
            Log.d(TAG, "RN dev loading hidden")
          }
        }
    }

  /**
   * RN 0.84 推荐的宿主对象。
   *
   * 之后主屏 Activity 的 reload、surface 创建等能力都会围绕它展开。由于当前工程要求
   * 主副屏各自独立重建，实际运行时两个进程会分别拥有自己的 [reactHost] 实例。
   */
  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(applicationContext, reactNativeHost)
  }

  /**
   * 应用创建入口。
   *
   * 使用 RN 0.84 新架构要求的 `loadReactNative(this)` 初始化运行时，避免手写旧版
   * `SoLoader.init(...)` / `DefaultNewArchitectureEntryPoint.load()` 这类初始化方式，
   * 从而兼容合并 so 的新实现。
   */
  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }

  private fun currentProcessName(): String =
    runCatching {
      File("/proc/${Process.myPid()}/cmdline")
        .readText(Charsets.UTF_8)
        .trim { it <= ' ' }
    }.getOrDefault(packageName)
}
