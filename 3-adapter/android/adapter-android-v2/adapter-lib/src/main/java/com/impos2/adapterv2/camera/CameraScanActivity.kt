package com.impos2.adapterv2.camera

import android.Manifest
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.os.Bundle
import android.os.ResultReceiver
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
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class CameraScanActivity : AppCompatActivity() {

  companion object {
    const val ACTION = "com.impos2.posadapter.action.CAMERA_SCAN"
    const val EXTRA_SCAN_RESULT = "SCAN_RESULT"
    const val EXTRA_SCAN_FORMAT = "SCAN_RESULT_FORMAT"
    const val EXTRA_ERROR = "error"
    const val EXTRA_RESULT_RECEIVER = "RESULT_RECEIVER"
    const val RESULT_CODE_SUCCESS = 1
    const val RESULT_CODE_FAILURE = 2
    private const val REQ_CAMERA = 2001
  }

  private lateinit var previewView: PreviewView
  private lateinit var overlayView: ScanOverlayView
  private lateinit var scanLine: View
  private lateinit var cameraExecutor: ExecutorService
  private val detected = AtomicBoolean(false)
  private var scanLineAnimator: ObjectAnimator? = null
  private var cameraProvider: ProcessCameraProvider? = null
  private var resultReceiver: ResultReceiver? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    WindowCompat.setDecorFitsSystemWindows(window, false)
    WindowInsetsControllerCompat(window, window.decorView).apply {
      hide(WindowInsetsCompat.Type.systemBars())
      systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    cameraExecutor = Executors.newSingleThreadExecutor()
    resultReceiver = intent?.getParcelableExtra(EXTRA_RESULT_RECEIVER)
    val root = buildLayout()
    setContentView(root)

    root.isFocusableInTouchMode = true
    root.requestFocus()

    if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
      startCamera()
    } else {
      ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), REQ_CAMERA)
    }
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    overlayView.post { startScanLineAnimation() }
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
      isClickable = false
      isFocusable = false
    }
    root.addView(overlayView)

    scanLine = View(this).apply {
      setBackgroundColor(0xFFFFFFFF.toInt())
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        3
      )
    }
    root.addView(scanLine)

    val hint = TextView(this).apply {
      text = "将条码/二维码对准扫描框"
      setTextColor(0xFFFFFFFF.toInt())
      textSize = 14f
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.WRAP_CONTENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
        Gravity.CENTER_HORIZONTAL or Gravity.TOP
      ).apply {
        topMargin = (resources.displayMetrics.heightPixels * 0.25f).toInt()
      }
    }
    root.addView(hint)

    val cancelBtn = Button(this).apply {
      text = "取消"
      setTextColor(0xFFFFFFFF.toInt())
      setBackgroundColor(0xCC000000.toInt())
      isClickable = true
      isFocusable = true
      val p = (16 * resources.displayMetrics.density).toInt()
      setPadding(p * 2, p, p * 2, p)
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.WRAP_CONTENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
        Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
      ).apply {
        bottomMargin = (80 * resources.displayMetrics.density).toInt()
      }
      setOnClickListener {
        if (!detected.getAndSet(true)) {
          finishWithError("CANCELED")
        }
      }
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
    scanLineAnimator = ObjectAnimator.ofFloat(scanLine, "y", frame.top, frame.bottom - 3).apply {
      duration = 1500
      repeatCount = ValueAnimator.INFINITE
      repeatMode = ValueAnimator.RESTART
      start()
    }
  }

  private fun startCamera() {
    val future = ProcessCameraProvider.getInstance(this)
    future.addListener(
      {
        try {
          bindCamera(future.get())
        } catch (_: Exception) {
          finishWithError("CAMERA_OPEN_FAILED")
        }
      },
      ContextCompat.getMainExecutor(this)
    )
  }

  private fun bindCamera(provider: ProcessCameraProvider) {
    if (isFinishing || isDestroyed) return

    cameraProvider = provider
    val preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }

    val formats = parseScanMode(intent.getStringExtra("SCAN_MODE"))
    val options = if (formats.isNotEmpty()) {
      BarcodeScannerOptions.Builder().setBarcodeFormats(formats[0], *formats.drop(1).toIntArray()).build()
    } else {
      BarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_ALL_FORMATS).build()
    }
    val scanner = BarcodeScanning.getClient(options)

    val analysis = ImageAnalysis.Builder()
      .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
      .build()
      .also { it.setAnalyzer(cameraExecutor) { proxy -> analyzeFrame(proxy, scanner) } }

    val selector = when {
      provider.hasCamera(CameraSelector.DEFAULT_BACK_CAMERA) -> CameraSelector.DEFAULT_BACK_CAMERA
      provider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA) -> CameraSelector.DEFAULT_FRONT_CAMERA
      else -> CameraSelector.Builder().addCameraFilter { it.take(1) }.build()
    }

    provider.unbindAll()
    provider.bindToLifecycle(this, selector, preview, analysis)
  }

  @ExperimentalGetImage
  private fun analyzeFrame(proxy: ImageProxy, scanner: com.google.mlkit.vision.barcode.BarcodeScanner) {
    if (detected.get()) {
      proxy.close()
      return
    }

    val mediaImage = proxy.image ?: run {
      proxy.close()
      return
    }

    val image = InputImage.fromMediaImage(mediaImage, proxy.imageInfo.rotationDegrees)
    scanner.process(image)
      .addOnSuccessListener { barcodes ->
        if (isFinishing) {
          proxy.close()
          return@addOnSuccessListener
        }
        val barcode = barcodes.firstOrNull { !it.rawValue.isNullOrEmpty() }
        if (barcode != null && detected.compareAndSet(false, true)) {
          setResult(
            RESULT_OK,
            Intent().apply {
              putExtra(EXTRA_SCAN_RESULT, barcode.rawValue ?: "")
              putExtra(EXTRA_SCAN_FORMAT, formatName(barcode.format))
            }
          )
          resultReceiver?.send(
            RESULT_CODE_SUCCESS,
            Bundle().apply {
              putString(EXTRA_SCAN_RESULT, barcode.rawValue ?: "")
              putString(EXTRA_SCAN_FORMAT, formatName(barcode.format))
            }
          )
          finish()
        }
      }
      .addOnFailureListener {
        if (detected.compareAndSet(false, true)) {
          finishWithError("CAMERA_SCAN_FAILED")
        }
      }
      .addOnCompleteListener { proxy.close() }
  }

  private fun parseScanMode(mode: String?): List<Int> = when (mode) {
    "QR_CODE_MODE" -> listOf(Barcode.FORMAT_QR_CODE)
    "BARCODE_MODE" -> listOf(
      Barcode.FORMAT_EAN_13,
      Barcode.FORMAT_EAN_8,
      Barcode.FORMAT_CODE_128,
      Barcode.FORMAT_CODE_39,
      Barcode.FORMAT_UPC_A,
      Barcode.FORMAT_UPC_E
    )

    else -> emptyList()
  }

  private fun formatName(format: Int): String = when (format) {
    Barcode.FORMAT_QR_CODE -> "QR_CODE"
    Barcode.FORMAT_EAN_13 -> "EAN_13"
    Barcode.FORMAT_EAN_8 -> "EAN_8"
    Barcode.FORMAT_CODE_128 -> "CODE_128"
    Barcode.FORMAT_CODE_39 -> "CODE_39"
    Barcode.FORMAT_UPC_A -> "UPC_A"
    Barcode.FORMAT_UPC_E -> "UPC_E"
    Barcode.FORMAT_DATA_MATRIX -> "DATA_MATRIX"
    Barcode.FORMAT_PDF417 -> "PDF417"
    Barcode.FORMAT_AZTEC -> "AZTEC"
    else -> "UNKNOWN"
  }

  private fun finishWithError(error: String) {
    resultReceiver?.send(
      RESULT_CODE_FAILURE,
      Bundle().apply {
        putString(EXTRA_ERROR, error)
      }
    )
    setResult(
      RESULT_CANCELED,
      Intent().apply {
        putExtra(EXTRA_ERROR, error)
      }
    )
    finish()
  }

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<String>,
    grantResults: IntArray
  ) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode == REQ_CAMERA) {
      if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
        startCamera()
      } else {
        finishWithError("CAMERA_PERMISSION_DENIED")
      }
    }
  }

  override fun onDestroy() {
    super.onDestroy()
    scanLineAnimator?.cancel()
    cameraProvider?.unbindAll()
    cameraExecutor.shutdown()
  }
}
