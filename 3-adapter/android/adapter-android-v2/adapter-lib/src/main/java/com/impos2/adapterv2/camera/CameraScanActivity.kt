package com.impos2.adapterv2.camera

import android.Manifest
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.os.ResultReceiver
import android.util.Log
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
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
    private const val TAG = "CameraScanActivity"
    const val ACTION = "com.impos2.posadapter.action.CAMERA_SCAN"
    const val EXTRA_SCAN_RESULT = "SCAN_RESULT"
    const val EXTRA_SCAN_FORMAT = "SCAN_RESULT_FORMAT"
    const val EXTRA_ERROR = "error"
    const val EXTRA_RESULT_RECEIVER = "RESULT_RECEIVER"
    const val RESULT_CODE_SUCCESS = 1
    const val RESULT_CODE_FAILURE = 2
    private const val REQ_CAMERA = 2001
    private const val DEFAULT_HINT = "将条码/二维码对准扫描框"
    private const val PICKER_HINT = "请选择一张包含条码/二维码的图片"
    private const val PICKER_PROCESSING_HINT = "正在识别图片..."
    private const val PICKER_EMPTY_HINT = "图片中未识别到条码/二维码，请重试"
    private const val PICKER_FAILED_HINT = "图片识别失败，请重试"
    private const val CAMERA_PERMISSION_HINT = "未授予相机权限，可使用“选图片”识别"

    @Volatile
    private var activeInstance: CameraScanActivity? = null

    fun cancelActiveScan() {
      val activity = activeInstance ?: return
      activity.runOnUiThread {
        if (activity.detected.compareAndSet(false, true)) {
          Log.i(TAG, "cancelActiveScan invoked")
          activity.finishWithError("CANCELED")
        }
      }
    }
  }

  private lateinit var previewView: PreviewView
  private lateinit var overlayView: ScanOverlayView
  private lateinit var scanLine: View
  private lateinit var hintText: TextView
  private lateinit var pickImageButton: Button
  private lateinit var cameraExecutor: ExecutorService
  private val detected = AtomicBoolean(false)
  private val pickerActive = AtomicBoolean(false)
  private var scanLineAnimator: ObjectAnimator? = null
  private var cameraProvider: ProcessCameraProvider? = null
  private var cameraScanner: com.google.mlkit.vision.barcode.BarcodeScanner? = null
  private var resultReceiver: ResultReceiver? = null
  private val openImageDocument =
    registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
      if (isFinishing || isDestroyed || detected.get()) {
        return@registerForActivityResult
      }

      if (uri == null) {
        pickerActive.set(false)
        setImagePickerBusy(false)
        updateHint(defaultHintText())
        resumeCameraPreviewIfAvailable()
        return@registerForActivityResult
      }

      analyzePickedImage(uri)
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    activeInstance = this
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

    hintText = TextView(this).apply {
      text = DEFAULT_HINT
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
    root.addView(hintText)

    val buttonBar = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.WRAP_CONTENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
        Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
      ).apply {
        bottomMargin = (80 * resources.displayMetrics.density).toInt()
      }
    }

    pickImageButton = Button(this).apply {
      text = "选图片"
      setTextColor(0xFFFFFFFF.toInt())
      setBackgroundColor(0xCC1B5E20.toInt())
      isClickable = true
      isFocusable = true
      val p = (16 * resources.displayMetrics.density).toInt()
      setPadding(p * 2, p, p * 2, p)
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply {
        marginEnd = (12 * resources.displayMetrics.density).toInt()
      }
      setOnClickListener {
        if (pickerActive.compareAndSet(false, true)) {
          pauseCameraPreview()
          setImagePickerBusy(true)
          updateHint(PICKER_HINT)
          runCatching {
            openImageDocument.launch(arrayOf("image/*"))
          }.onFailure { error ->
            handlePickedImageFailure(error.message ?: "IMAGE_PICKER_OPEN_FAILED")
          }
        }
      }
    }
    buttonBar.addView(pickImageButton)

    val cancelBtn = Button(this).apply {
      text = "取消"
      setTextColor(0xFFFFFFFF.toInt())
      setBackgroundColor(0xCC000000.toInt())
      isClickable = true
      isFocusable = true
      val p = (16 * resources.displayMetrics.density).toInt()
      setPadding(p * 2, p, p * 2, p)
      layoutParams = LinearLayout.LayoutParams(
        FrameLayout.LayoutParams.WRAP_CONTENT,
        FrameLayout.LayoutParams.WRAP_CONTENT
      )
      setOnClickListener {
        if (!detected.getAndSet(true)) {
          finishWithError("CANCELED")
        }
      }
    }
    buttonBar.addView(cancelBtn)
    root.addView(buttonBar)

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
    cameraScanner?.close()
    val scanner = createScanner().also { cameraScanner = it }

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
    if (detected.get() || pickerActive.get()) {
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
          finishWithSuccess(barcode.rawValue ?: "", barcode.format)
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

  private fun createScanner(): com.google.mlkit.vision.barcode.BarcodeScanner {
    val formats = parseScanMode(intent.getStringExtra("SCAN_MODE"))
    val options = if (formats.isNotEmpty()) {
      BarcodeScannerOptions.Builder().setBarcodeFormats(formats[0], *formats.drop(1).toIntArray()).build()
    } else {
      BarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_ALL_FORMATS).build()
    }
    return BarcodeScanning.getClient(options)
  }

  private fun analyzePickedImage(uri: Uri) {
    updateHint(PICKER_PROCESSING_HINT)

    cameraExecutor.execute {
      val image = runCatching {
        contentResolver.openInputStream(uri)?.use { input ->
          val bitmap = BitmapFactory.decodeStream(input) ?: error("IMAGE_DECODE_FAILED")
          InputImage.fromBitmap(bitmap, 0)
        } ?: error("IMAGE_READ_FAILED")
      }.getOrElse { error ->
        runOnUiThread {
          handlePickedImageFailure(error.message ?: "IMAGE_READ_FAILED")
        }
        return@execute
      }

      val scanner = createScanner()
      scanner.process(image)
        .addOnSuccessListener(ContextCompat.getMainExecutor(this)) { barcodes ->
          val barcode = barcodes.firstOrNull { !it.rawValue.isNullOrEmpty() }
          if (barcode != null && detected.compareAndSet(false, true)) {
            finishWithSuccess(barcode.rawValue ?: "", barcode.format)
          } else {
            handlePickedImageFailure("NO_BARCODE_FOUND", PICKER_EMPTY_HINT)
          }
        }
        .addOnFailureListener(ContextCompat.getMainExecutor(this)) { error ->
          handlePickedImageFailure(error.message ?: "IMAGE_SCAN_FAILED")
        }
        .addOnCompleteListener {
          scanner.close()
        }
    }
  }

  private fun handlePickedImageFailure(error: String, hint: String = PICKER_FAILED_HINT) {
    Log.w(TAG, "picked image scan failed: $error")
    pickerActive.set(false)
    setImagePickerBusy(false)
    updateHint(hint)
    resumeCameraPreviewIfAvailable()
  }

  private fun pauseCameraPreview() {
    cameraProvider?.unbindAll()
    scanLineAnimator?.cancel()
  }

  private fun resumeCameraPreviewIfAvailable() {
    if (detected.get()) {
      return
    }
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
      startCamera()
    }
  }

  private fun setImagePickerBusy(busy: Boolean) {
    pickImageButton.isEnabled = !busy
    pickImageButton.alpha = if (busy) 0.6f else 1f
    pickImageButton.text = if (busy) "识别中..." else "选图片"
  }

  private fun defaultHintText(): String {
    return if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
      DEFAULT_HINT
    } else {
      CAMERA_PERMISSION_HINT
    }
  }

  private fun updateHint(text: String) {
    hintText.text = text
  }

  private fun finishWithSuccess(result: String, format: Int) {
    setResult(
      RESULT_OK,
      Intent().apply {
        putExtra(EXTRA_SCAN_RESULT, result)
        putExtra(EXTRA_SCAN_FORMAT, formatName(format))
      }
    )
    resultReceiver?.send(
      RESULT_CODE_SUCCESS,
      Bundle().apply {
        putString(EXTRA_SCAN_RESULT, result)
        putString(EXTRA_SCAN_FORMAT, formatName(format))
      }
    )
    finish()
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
        updateHint(CAMERA_PERMISSION_HINT)
      }
    }
  }

  override fun onDestroy() {
    super.onDestroy()
    if (activeInstance === this) {
      activeInstance = null
    }
    scanLineAnimator?.cancel()
    cameraProvider?.unbindAll()
    cameraScanner?.close()
    cameraExecutor.shutdown()
  }
}
