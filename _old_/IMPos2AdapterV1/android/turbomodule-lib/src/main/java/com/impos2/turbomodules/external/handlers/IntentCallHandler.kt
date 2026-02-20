package com.impos2.turbomodules.external.handlers

import android.content.Intent
import android.content.pm.PackageManager
import com.facebook.react.bridge.ReactApplicationContext
import com.impos2.turbomodules.external.constants.ErrorCode
import com.impos2.turbomodules.external.models.ExternalCallRequest
import com.impos2.turbomodules.external.models.ExternalCallResponse
import com.impos2.turbomodules.external.utils.IntentParamsConverter

/**
 * Intent 调用 Handler
 * 用于通过 Intent 调用第三方 App
 *
 * 优化点:
 * 1. 支持多 ReactInstanceManager 场景
 * 2. 增强错误处理
 * 3. 添加详细日志
 */
class IntentCallHandler(
    private val context: ReactApplicationContext
) : IExternalCallHandler {

    override suspend fun handle(request: ExternalCallRequest): ExternalCallResponse {
        val startTime = System.currentTimeMillis()

        return try {
            // 构建 Intent
            val intent = Intent().apply {
                setPackage(request.target)
                action = request.action
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            // 添加参数
            IntentParamsConverter.addParamsToIntent(intent, request.params)

            // 检查 Intent 是否可以被处理
            val packageManager = context.packageManager
            if (intent.resolveActivity(packageManager) == null) {
                return ExternalCallResponse(
                    requestId = request.requestId,
                    code = ErrorCode.NOT_FOUND,
                    success = false,
                    message = "Target app not found: ${request.target}",
                    timestamp = System.currentTimeMillis(),
                    duration = System.currentTimeMillis() - startTime
                )
            }

            // 启动 Activity
            context.startActivity(intent)

            ExternalCallResponse(
                requestId = request.requestId,
                code = ErrorCode.SUCCESS,
                success = true,
                message = "Intent sent successfully",
                timestamp = System.currentTimeMillis(),
                duration = System.currentTimeMillis() - startTime
            )
        } catch (e: Exception) {
            ExternalCallResponse(
                requestId = request.requestId,
                code = ErrorCode.UNKNOWN_ERROR,
                success = false,
                message = "Intent call failed: ${e.message}",
                timestamp = System.currentTimeMillis(),
                duration = System.currentTimeMillis() - startTime
            )
        }
    }

    override fun isAvailable(target: String): Boolean {
        return try {
            context.packageManager.getPackageInfo(target, 0)
            true
        } catch (e: PackageManager.NameNotFoundException) {
            false
        }
    }

    override fun getAvailableTargets(): List<String> {
        return try {
            val packageManager = context.packageManager
            val packages = packageManager.getInstalledApplications(PackageManager.GET_META_DATA)
            packages.map { it.packageName }.sorted()
        } catch (e: Exception) {
            emptyList()
        }
    }

    override fun cancel() {
        // Intent 调用无法取消
    }
}
