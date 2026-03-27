# CameraScanActivity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 `turbomodule-lib` 内嵌实现 `CameraScanActivity`，通过 CameraX + ML Kit 提供摄像头扫码能力，经由现有 `IntentChannel + ResultBridgeActivity` 链路供 `readBarCodeFromCamera` TaskDefinition 调用。

**Architecture:** `CameraScanActivity` 是一个全屏透明主题 Activity，使用 CameraX `PreviewView` 显示相机画面，`ImageAnalysis` 用例将帧送入 ML Kit `BarcodeScanner`；扫到码后调用 `setResult(RESULT_OK)` 并 `finish()`，由 `ResultBridgeActivity` 的 `onActivityResult` 通过广播回传给 `IntentChannel`。UI 由自定义 `ScanOverlayView` 绘制半透明遮罩、扫描框、四角标记，扫描线用 `ObjectAnimator` 驱动。

**Tech Stack:** Kotlin、CameraX 1.3.4、ML Kit barcode-scanning 17.3.0、ObjectAnimator、PorterDuff.Mode.CLEAR

---

### Task 1: 新增 CameraX + ML Kit 依赖

**Files:**
- Modify: `3-adapter/android/pos-adapter/android/turbomodule-lib/build.gradle`

**Step 1: 在 `dependencies` 块末尾追加依赖**

```groovy
// CameraX
implementation "androidx.camera:camera-core:1.3.4"
implementation "androidx.camera:camera-camera2:1.3.4"
implementation "androidx.camera:camera-lifecycle:1.3.4"
implementation "androidx.camera:camera-view:1.3.4"
// ML Kit 条码识别
implementation "com.google.mlkit:barcode-scanning:17.3.0"
```

**Step 2: Sync Gradle**

在 Android Studio 中点击 "Sync Now"，或运行：
```bash
cd 3-adapter/android/pos-adapter/android
./gradlew :turbomodule-lib:dependencies --configuration releaseRuntimeClasspath | grep -E "camera|mlkit|barcode"
```
Expected: 能看到 `camera-core`、`barcode-scanning` 等依赖被解析。

**Step 3: Commit**

```bash
git add 3-adapter/android/pos-adapter/android/turbomodule-lib/build.gradle
git commit -m "feat(turbomodule-lib): add CameraX + ML Kit dependencies"
```

---

### Task 2: 更新 AndroidManifest.xml

**Files:**
- Modify: `3-adapter/android/pos-adapter/android/turbomodule-lib/src/main/AndroidManifest.xml`

**Step 1: 添加 CAMERA 权限和 CameraScanActivity 注册**

将文件内容替换为：

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />

    <application>
        <activity
            android:name="com.impos2.posadapter.turbomodules.connector.channels.ResultBridgeActivity"
            android:theme="@android:style/Theme.Translucent.NoTitleBar"
            android:exported="false" />
        <activity
            android:name="com.impos2.posadapter.turbomodules.connector.channels.CameraScanActivity"
            android:theme="@android:style/Theme.Black.NoTitleBar.Fullscreen"
            android:screenOrientation="portrait"
            android:exported="false" />
    </application>
</manifest>
```

**Step 2: Commit**

```bash
git add 3-adapter/android/pos-adapter/android/turbomodule-lib/src/main/AndroidManifest.xml
git commit -m "feat(turbomodule-lib): register CameraScanActivity and CAMERA permission"
```

---

### Task 3: 实现 ScanOverlayView

**Files:**
- Create: `3-adapter/android/pos-adapter/android/turbomodule-lib/src/main/java/com/impos2/posadapter/turbomodules/connector/channels/ScanOverlayView.kt`

**Step 1: 创建文件，内容如下**

```kotlin
package com.impos2.posadapter.turbomodules.connector.channels

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RectF
import android.util.AttributeSet
import android.view.View

/**
 * 扫码遮罩 View：半透明黑色背景 + 透明扫描框 + 白色四角标记
 * 扫描线由外部 View + ObjectAnimator 驱动，不在此绘制。
 */
class ScanOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    companion object {
        private const val FRAME_SIZE_DP = 260f
        private const val CORNER_ARM_DP  = 20f
        private const val CORNER_STROKE_DP = 3f
        private const val MASK_ALPHA = 0x99 // ~60% 透明度
    }

    private val density = context.resources.displayMetrics.density

    private val maskPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(MASK_ALPHA, 0, 0, 0)
    }
    private val clearPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        xfermode = PorterDuffXfermode(PorterDuff.Mode.CLEAR)
    }
    private val cornerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = CORNER_STROKE_DP * density
        strokeCap = Paint.Cap.SQUARE
    }

    /** 扫描框在屏幕上的位置，供外部获取以定位扫描线 */
    val frameRect = RectF()

    init {
        setLayerType(LAYER_TYPE_SOFTWARE, null) // PorterDuff.CLEAR 需要软件渲染
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        val size = FRAME_SIZE_DP * density
        val cx = w / 2f
        val cy = h / 2f
        frameRect.set(cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2)
    }

    override fun onDraw(canvas: Canvas) {
        // 1. 半透明遮罩
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), maskPaint)
        // 2. 挖空扫描框
        canvas.drawRect(frameRect, clearPaint)
        // 3. 四角标记
        drawCorners(canvas)
    }

    private fun drawCorners(canvas: Canvas) {
        val arm = CORNER_ARM_DP * density
        val l = frameRect.left
        val t = frameRect.top
        val r = frameRect.right
        val b = frameRect.bottom
        // 左上
        canvas.drawLine(l, t, l + arm, t, cornerPaint)
        canvas.drawLine(l, t, l, t + arm, cornerPaint)
        // 右上
        canvas.drawLine(r - arm, t, r, t, cornerPaint)
        canvas.drawLine(r, t, r, t + arm, cornerPaint)
        // 左下
        canvas.drawLine(l, b - arm, l, b, cornerPaint)
        canvas.drawLine(l, b, l + arm, b, cornerPaint)
        // 右下
        canvas.drawLine(r - arm, b, r, b, cornerPaint)
        canvas.drawLine(r, b - arm, r, b, cornerPaint)
    }
}
```

**Step 2: Commit**

```bash
git add 3-adapter/android/pos-adapter/android/turbomodule-lib/src/main/java/com/impos2/posadapter/turbomodules/connector/channels/ScanOverlayView.kt
git commit -m "feat(turbomodule-lib): add ScanOverlayView with scan frame and corner markers"
```

---

### Task 4: 实现 CameraScanActivity

**Files:**
- Create: `3-adapter/android/pos-adapter/android/turbomodule-lib/src/main/java/com/impos2/posadapter/turbomodules/connector/channels/CameraScanActivity.kt`

**Step 1: 创建文件，内容如下**

```kotlin
package com.impos2.posadapter.turbomodules.connector.channels

import android.Manifest
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Button
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class CameraScanActivity : Activity() {

    companion object {
        const val ACTION = "com.impos2.posadapter.action.CAMERA_SCAN"
        const val EXTRA_SCAN_RESULT  = "SCAN_RESULT"
        const val EXTRA_SCAN_FORMAT  = "SCAN_RESULT_FORMAT"
        const val EXTRA_ERROR        = "error"
        private const val RC_CAMERA  = 1001
    }

    private lateinit var previewView: PreviewView
    private lateinit var overlayView: ScanOverlayView
    private lateinit var scanLine: View
    private lateinit var cameraExecutor: ExecutorService
    private val detected = AtomicBoolean(false)
    private var scanLineAnimator: ObjectAnimator? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        cameraExecutor = Executors.newSingleThreadExecutor()
        setContentView(buildLayout())

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED) {
            startCamera()
        } else {
            finishWithError("CAMERA_PERMISSION_DENIED")
        }
    }

    // ── 布局（纯代码，无 XML）────────────────────────────────────────────────

    private fun buildLayout(): FrameLayout {
        val root = FrameLayout(this)

        // 1. 相机预览
        previewView = PreviewView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        root.addView(previewView)

        // 2. 遮罩 + 扫描框
        overlayView = ScanOverlayView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        root.addView(overlayView)

        // 3. 扫描线（在 overlay onLayout 后定位）
        scanLine = View(this).apply {
            setBackgroundColor(0xFFFFFFFF.toInt())
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, 3
            )
        }
        root.addView(scanLine)

        // 4. 提示文字
        val hint = TextView(this).apply {
            text = "将条码/二维码对准扫描框"
            setTextColor(0xFFFFFFFF.toInt())
            textSize = 14f
            val lp = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER_HORIZONTAL or Gravity.TOP
            )
            lp.topMargin = (resources.displayMetrics.heightPixels * 0.25f).toInt()
            layoutParams = lp
        }
        root.addView(hint)

        // 5. 取消按钮
        val cancelBtn = Button(this).apply {
            text = "取消"
            setTextColor(0xFFFFFFFF.toInt())
            setBackgroundColor(0x66000000.toInt())
            val lp = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            )
            lp.bottomMargin = (48 * resources.displayMetrics.density).toInt()
            layoutParams = lp
            setOnClickListener { setResult(RESULT_CANCELED); finish() }
        }
        root.addView(cancelBtn)

        // 6. overlay 布局完成后启动扫描线动画
        overlayView.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
            startScanLineAnimation()
        }

        return root
    }

    // ── 扫描线动画 ────────────────────────────────────────────────────────────

    private fun startScanLineAnimation() {
        val frame = overlayView.frameRect
        if (frame.isEmpty) return
        scanLine.x = frame.left
        scanLine.y = frame.top
        (scanLine.layoutParams as FrameLayout.LayoutParams).width = frame.width().toInt()
        scanLine.requestLayout()

        scanLineAnimator?.cancel()
        scanLineAnimator = ObjectAnimator.ofFloat(scanLine, "y", frame.top, frame.bottom - 3).apply {
            duration = 1500
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.RESTART
            start()
        }
    }

    // ── 相机 ──────────────────────────────────────────────────────────────────

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            try {
                val cameraProvider = cameraProviderFuture.get()
                bindCamera(cameraProvider)
            } catch (e: Exception) {
                finishWithError("CAMERA_OPEN_FAILED")
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun bindCamera(cameraProvider: ProcessCameraProvider) {
        val preview = Preview.Builder().build().also {
            it.setSurfaceProvider(previewView.surfaceProvider)
        }

        val formats = parseScanMode(intent.getStringExtra("SCAN_MODE"))
        val options = if (formats.isNotEmpty())
            BarcodeScannerOptions.Builder().setBarcodeFormats(formats[0], *formats.drop(1).toIntArray()).build()
        else
            BarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_ALL_FORMATS).build()

        val scanner = BarcodeScanning.getClient(options)

        val analysis = ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()
            .also { ia ->
                ia.setAnalyzer(cameraExecutor) { proxy -> analyzeFrame(proxy, scanner) }
            }

        cameraProvider.unbindAll()
        cameraProvider.bindToLifecycle(this as LifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)
    }

    @androidx.camera.core.ExperimentalGetImage
    private fun analyzeFrame(proxy: ImageProxy, scanner: com.google.mlkit.vision.barcode.BarcodeScanner) {
        if (detected.get()) { proxy.close(); return }
        val mediaImage = proxy.image ?: run { proxy.close(); return }
        val image = InputImage.fromMediaImage(mediaImage, proxy.imageInfo.rotationDegrees)
        scanner.process(image)
            .addOnSuccessListener { barcodes ->
                val barcode = barcodes.firstOrNull { !it.rawValue.isNullOrEmpty() }
                if (barcode != null && detected.compareAndSet(false, true)) {
                    val result = Intent().apply {
                        putExtra(EXTRA_SCAN_RESULT, barcode.rawValue ?: "")
                        putExtra(EXTRA_SCAN_FORMAT, formatName(barcode.format))
                    }
                    setResult(RESULT_OK, result)
                    finish()
                }
            }
            .addOnCompleteListener { proxy.close() }
    }

    // ── 工具方法 ──────────────────────────────────────────────────────────────

    private fun parseScanMode(mode: String?): List<Int> = when (mode) {
        "QR_CODE_MODE"  -> listOf(Barcode.FORMAT_QR_CODE)
        "BARCODE_MODE"  -> listOf(
            Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8,
            Barcode.FORMAT_CODE_128, Barcode.FORMAT_CODE_39,
            Barcode.FORMAT_UPC_A, Barcode.FORMAT_UPC_E
        )
        else -> emptyList() // ALL
    }

    private fun formatName(format: Int): String = when (format) {
        Barcode.FORMAT_QR_CODE   -> "QR_CODE"
        Barcode.FORMAT_EAN_13    -> "EAN_13"
        Barcode.FORMAT_EAN_8     -> "EAN_8"
        Barcode.FORMAT_CODE_128  -> "CODE_128"
        Barcode.FORMAT_CODE_39   -> "CODE_39"
        Barcode.FORMAT_UPC_A     -> "UPC_A"
        Barcode.FORMAT_UPC_E     -> "UPC_E"
        Barcode.FORMAT_DATA_MATRIX -> "DATA_MATRIX"
        Barcode.FORMAT_PDF417    -> "PDF417"
        Barcode.FORMAT_AZTEC     -> "AZTEC"
        else -> "UNKNOWN"
    }

    private fun finishWithError(error: String) {
        setResult(RESULT_CANCELED, Intent().putExtra(EXTRA_ERROR, error))
        finish()
    }

    override fun onDestroy() {
        super.onDestroy()
        scanLineAnimator?.cancel()
        cameraExecutor.shutdown()
    }
}
```

**Step 2: Commit**

```bash
git add 3-adapter/android/pos-adapter/android/turbomodule-lib/src/main/java/com/impos2/posadapter/turbomodules/connector/channels/CameraScanActivity.kt
git commit -m "feat(turbomodule-lib): implement CameraScanActivity with CameraX + ML Kit"
```

---

### Task 5: 更新 readBarCodeFromCamera.ts

**Files:**
- Modify: `3-adapter/android/pos-adapter/dev/testTask/readBarCodeFromCamera.ts`

**Step 1: 将 action 改为 `CameraScanActivity.ACTION`，更新 resultScript**

```typescript
import {TaskDefinition} from '@impos2/kernel-core-task'

export const readBarCodeFromCamera: TaskDefinition = {
    key: 'readBarCodeFromCamera',
    name: '摄像头扫码',
    timeout: 30000,
    enabled: true,
    testContext: {},
    rootNode: {
        key: 'scanFromCamera',
        name: '调用摄像头扫码',
        type: 'externalCall',
        timeout: 29000,
        strategy: { errorStrategy: 'skip' },
        argsScript: `
            return {
                channel: { type: 'INTENT', target: 'camera', mode: 'request-response' },
                action: 'com.impos2.posadapter.action.CAMERA_SCAN',
                params: { waitResult: true, SCAN_MODE: 'ALL' },
                timeout: 29000
            }
        `,
        // params.success=false → 用户取消或权限拒绝
        // params.data.SCAN_RESULT → 扫码内容
        resultScript: `
            if (!params || !params.success) {
                var err = params && params.data && params.data.error ? params.data.error : 'CANCELED'
                throw new Error('摄像头扫码失败: ' + err)
            }
            var data = params.data || {}
            return {
                barcode: data.SCAN_RESULT || '',
                format: data.SCAN_RESULT_FORMAT || 'UNKNOWN',
                timestamp: params.timestamp
            }
        `,
    },
}
```

**Step 2: Commit**

```bash
git add 3-adapter/android/pos-adapter/dev/testTask/readBarCodeFromCamera.ts
git commit -m "feat(testTask): update readBarCodeFromCamera to use CameraScanActivity"
```

---

### Task 6: 构建验证

**Step 1: 编译 turbomodule-lib**

```bash
cd 3-adapter/android/pos-adapter/android
./gradlew :turbomodule-lib:compileDebugKotlin
```
Expected: `BUILD SUCCESSFUL`，无编译错误。

**Step 2: 安装到设备并测试**

```bash
cd 3-adapter/android/pos-adapter
yarn android
```

在 TaskTest 页面选择 `readBarCodeFromCamera`，点击 RUN：
- 应弹出全屏扫码界面（黑色遮罩 + 扫描框 + 扫描线动画）
- 对准条码/二维码后自动识别并返回
- 点击取消按钮应返回 `NODE_ERROR: 摄像头扫码失败: CANCELED`

**Step 3: 验证 console 日志**

成功扫码时应看到：
```
LOG  [TaskTest] NODE_COMPLETE { payload: { barcode: "...", format: "QR_CODE", ... } }
```
