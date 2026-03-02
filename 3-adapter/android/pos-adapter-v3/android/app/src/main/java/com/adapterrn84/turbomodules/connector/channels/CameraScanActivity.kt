package com.adapterrn84.turbomodules.connector.channels

import android.Manifest
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.FrameLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class CameraScanActivity : AppCompatActivity() {

    companion object {
        const val SCAN_RESULT        = "SCAN_RESULT"
        const val SCAN_RESULT_FORMAT = "SCAN_RESULT_FORMAT"
        const val EXTRA_ERROR        = "error"
        private const val REQ_CAMERA = 2001
        private const val TAG        = "CameraScanActivity"
    }

    private lateinit var previewView: PreviewView
    private lateinit var overlayView: ScanOverlayView
    private lateinit var scanLine: View
    private lateinit var cameraExecutor: ExecutorService
    private val detected = AtomicBoolean(false)
    private var scanLineAnimator: ObjectAnimator? = null
    private var resultBroadcastAction: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d(TAG, "onCreate")
        resultBroadcastAction = intent.getStringExtra("resultBroadcastAction")
        Log.d(TAG, "resultBroadcastAction=$resultBroadcastAction")

        // 全屏（AppCompat 兼容方式）
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        cameraExecutor = Executors.newSingleThreadExecutor()
        setContentView(buildLayout())

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED
        ) {
            Log.d(TAG, "camera permission granted, starting camera")
            startCamera()
        } else {
            Log.d(TAG, "requesting camera permission")
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), REQ_CAMERA)
        }
    }

    private fun buildLayout(): FrameLayout {
        val root = FrameLayout(this)

        previewView = PreviewView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        root.addView(previewView)

        overlayView = ScanOverlayView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        root.addView(overlayView)

        scanLine = View(this).apply {
            setBackgroundColor(0xFFFFFFFF.toInt())
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, 3)
        }
        root.addView(scanLine)

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
            setOnClickListener { sendErrorBroadcast("CANCELED"); finish() }
        }
        root.addView(cancelBtn)

        overlayView.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
            startScanLineAnimation()
        }

        return root
    }

    private fun startScanLineAnimation() {
        val frame = overlayView.frameRect
        if (frame.isEmpty) return
        scanLine.x = frame.left
        scanLine.y = frame.top
        (scanLine.layoutParams as FrameLayout.LayoutParams).width = frame.width().toInt()
        scanLine.requestLayout()

        scanLineAnimator?.cancel()
        scanLineAnimator = ObjectAnimator.ofFloat(scanLine, "y", frame.top, frame.bottom - 3f).apply {
            duration = 1500
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.RESTART
            start()
        }
    }

    private fun startCamera() {
        Log.d(TAG, "startCamera")
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener({
            try {
                bindCamera(future.get())
            } catch (e: Exception) {
                Log.e(TAG, "camera open failed", e)
                finishWithError("CAMERA_OPEN_FAILED")
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun bindCamera(cameraProvider: ProcessCameraProvider) {
        Log.d(TAG, "bindCamera")
        val preview = Preview.Builder().build().also {
            it.setSurfaceProvider(previewView.surfaceProvider)
        }

        val scanMode = intent.getStringExtra("SCAN_MODE")
        Log.d(TAG, "SCAN_MODE=$scanMode")
        val formats = parseScanMode(scanMode)
        val options = if (formats.isNotEmpty())
            BarcodeScannerOptions.Builder()
                .setBarcodeFormats(formats[0], *formats.drop(1).toIntArray())
                .build()
        else
            BarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_ALL_FORMATS)
                .build()

        val scanner = BarcodeScanning.getClient(options)

        val analysis = ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()
            .also { it.setAnalyzer(cameraExecutor) { proxy -> analyzeFrame(proxy, scanner) } }

        val availableCameras = cameraProvider.availableCameraInfos
        Log.d(TAG, "availableCameras count=${availableCameras.size}")

        val cameraIndexStr = intent.getStringExtra("CAMERA_INDEX")
        val cameraSelector = if (cameraIndexStr != null) {
            // 调用方通过 CAMERA_INDEX 指定摄像头
            val idx = cameraIndexStr.toIntOrNull() ?: 0
            if (idx < availableCameras.size) {
                val lensFacing = availableCameras[idx].lensFacing
                Log.d(TAG, "using CAMERA_INDEX=$idx, lensFacing=$lensFacing")
                CameraSelector.Builder().requireLensFacing(lensFacing).build()
            } else {
                Log.e(TAG, "CAMERA_INDEX=$idx out of range (count=${availableCameras.size})")
                finishWithError("CAMERA_INDEX_OUT_OF_RANGE")
                return
            }
        } else {
            when {
                cameraProvider.hasCamera(CameraSelector.DEFAULT_BACK_CAMERA)  -> CameraSelector.DEFAULT_BACK_CAMERA
                cameraProvider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA) -> CameraSelector.DEFAULT_FRONT_CAMERA
                availableCameras.isNotEmpty() -> {
                    val lensFacing = availableCameras[0].lensFacing
                    Log.d(TAG, "using non-standard camera[0], lensFacing=$lensFacing")
                    CameraSelector.Builder().requireLensFacing(lensFacing).build()
                }
                else -> {
                    Log.e(TAG, "no camera available")
                    finishWithError("NO_CAMERA")
                    return
                }
            }
        }

        try {
            cameraProvider.unbindAll()
            cameraProvider.bindToLifecycle(this, cameraSelector, preview, analysis)
            Log.d(TAG, "camera bound successfully")
        } catch (e: Exception) {
            Log.e(TAG, "bindToLifecycle failed", e)
            finishWithError("CAMERA_BIND_FAILED")
        }
    }

    @ExperimentalGetImage
    private fun analyzeFrame(proxy: ImageProxy, scanner: com.google.mlkit.vision.barcode.BarcodeScanner) {
        if (detected.get()) { proxy.close(); return }
        val mediaImage = proxy.image ?: run { proxy.close(); return }
        val image = InputImage.fromMediaImage(mediaImage, proxy.imageInfo.rotationDegrees)
        scanner.process(image)
            .addOnSuccessListener { barcodes ->
                val barcode = barcodes.firstOrNull { !it.rawValue.isNullOrEmpty() }
                if (barcode != null && detected.compareAndSet(false, true)) {
                    Log.d(TAG, "barcode detected: ${barcode.rawValue}")
                    val resultJson = org.json.JSONObject().apply {
                        put(SCAN_RESULT, barcode.rawValue ?: "")
                        put(SCAN_RESULT_FORMAT, formatName(barcode.format))
                    }.toString()
                    sendResultBroadcast(resultJson)
                    finish()
                }
            }
            .addOnCompleteListener { proxy.close() }
    }

    private fun parseScanMode(mode: String?): List<Int> = when (mode) {
        "QR_CODE_MODE" -> listOf(Barcode.FORMAT_QR_CODE)
        "BARCODE_MODE" -> listOf(
            Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8,
            Barcode.FORMAT_CODE_128, Barcode.FORMAT_CODE_39,
            Barcode.FORMAT_UPC_A, Barcode.FORMAT_UPC_E
        )
        else -> emptyList()
    }

    private fun formatName(format: Int): String = when (format) {
        Barcode.FORMAT_QR_CODE     -> "QR_CODE"
        Barcode.FORMAT_EAN_13      -> "EAN_13"
        Barcode.FORMAT_EAN_8       -> "EAN_8"
        Barcode.FORMAT_CODE_128    -> "CODE_128"
        Barcode.FORMAT_CODE_39     -> "CODE_39"
        Barcode.FORMAT_UPC_A       -> "UPC_A"
        Barcode.FORMAT_UPC_E       -> "UPC_E"
        Barcode.FORMAT_DATA_MATRIX -> "DATA_MATRIX"
        Barcode.FORMAT_PDF417      -> "PDF417"
        Barcode.FORMAT_AZTEC       -> "AZTEC"
        else                       -> "UNKNOWN"
    }

    private fun sendResultBroadcast(resultJson: String) {
        resultBroadcastAction?.let { action ->
            Log.d(TAG, "sendResultBroadcast: action=$action")
            sendBroadcast(Intent(action).apply {
                setPackage(packageName)
                putExtra("resultData", resultJson)
            })
        } ?: Log.w(TAG, "sendResultBroadcast: no resultBroadcastAction")
    }

    private fun sendErrorBroadcast(error: String) {
        resultBroadcastAction?.let { action ->
            Log.d(TAG, "sendErrorBroadcast: action=$action error=$error")
            sendBroadcast(Intent(action).apply {
                setPackage(packageName)
                putExtra("error", error)
            })
        } ?: Log.w(TAG, "sendErrorBroadcast: no resultBroadcastAction")
    }

    private fun finishWithError(error: String) {
        Log.e(TAG, "finishWithError: $error")
        sendErrorBroadcast(error)
        finish()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_CAMERA) {
            if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "camera permission granted")
                startCamera()
            } else {
                Log.w(TAG, "camera permission denied")
                finishWithError("CAMERA_PERMISSION_DENIED")
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "onDestroy")
        scanLineAnimator?.cancel()
        if (::cameraExecutor.isInitialized) cameraExecutor.shutdown()
    }
}
