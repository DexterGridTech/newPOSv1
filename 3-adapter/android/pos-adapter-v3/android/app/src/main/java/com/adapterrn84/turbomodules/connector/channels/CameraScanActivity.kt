package com.adapterrn84.turbomodules.connector.channels

import android.Manifest
import android.animation.ObjectAnimator
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.animation.LinearInterpolator
import android.widget.Button
import android.widget.FrameLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class CameraScanActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_SCAN_MODE = "scan_mode"
        const val SCAN_RESULT = "scan_result"
        const val SCAN_RESULT_FORMAT = "scan_result_format"
        
        const val QR_CODE_MODE = "qr_code"
        const val BARCODE_MODE = "barcode"
        
        private const val REQUEST_CAMERA_PERMISSION = 1001
    }

    private lateinit var previewView: PreviewView
    private lateinit var overlayView: ScanOverlayView
    private lateinit var scanLineView: View
    private lateinit var hintText: TextView
    private lateinit var cancelButton: Button
    
    private lateinit var cameraExecutor: ExecutorService
    private var camera: Camera? = null
    private var isScanning = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Check camera permission
        if (!hasCameraPermission()) {
            requestCameraPermission()
            return
        }
        
        setupUI()
        startCamera()
    }

    private fun hasCameraPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun requestCameraPermission() {
        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.CAMERA),
            REQUEST_CAMERA_PERMISSION
        )
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        
        if (requestCode == REQUEST_CAMERA_PERMISSION) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                setupUI()
                startCamera()
            } else {
                setResult(RESULT_CANCELED, Intent().apply {
                    putExtra("error", "CAMERA_PERMISSION_DENIED")
                })
                finish()
            }
        }
    }

    private fun setupUI() {
        val rootLayout = FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.BLACK)
        }

        // Camera preview
        previewView = PreviewView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        rootLayout.addView(previewView)

        // Overlay with scan frame
        overlayView = ScanOverlayView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        rootLayout.addView(overlayView)

        // Scan line animation
        scanLineView = View(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                dpToPx(260),
                dpToPx(2)
            ).apply {
                gravity = Gravity.CENTER_HORIZONTAL
                topMargin = (resources.displayMetrics.heightPixels - dpToPx(260)) / 2
            }
            setBackgroundColor(Color.WHITE)
        }
        rootLayout.addView(scanLineView)

        // Hint text
        hintText = TextView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.CENTER_HORIZONTAL or Gravity.BOTTOM
                bottomMargin = dpToPx(100)
            }
            text = "将二维码/条形码放入框内"
            setTextColor(Color.WHITE)
            textSize = 16f
        }
        rootLayout.addView(hintText)

        // Cancel button
        cancelButton = Button(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.CENTER_HORIZONTAL or Gravity.BOTTOM
                bottomMargin = dpToPx(40)
            }
            text = "取消"
            setOnClickListener {
                setResult(RESULT_CANCELED)
                finish()
            }
        }
        rootLayout.addView(cancelButton)

        setContentView(rootLayout)

        // Start scan line animation
        startScanLineAnimation()
    }

    private fun startScanLineAnimation() {
        val scanFrameHeight = dpToPx(260)
        val startY = (resources.displayMetrics.heightPixels - scanFrameHeight) / 2
        val endY = startY + scanFrameHeight

        ObjectAnimator.ofFloat(scanLineView, "y", startY.toFloat(), endY.toFloat()).apply {
            duration = 2000
            repeatCount = ObjectAnimator.INFINITE
            repeatMode = ObjectAnimator.RESTART
            interpolator = LinearInterpolator()
            start()
        }
    }

    private fun startCamera() {
        cameraExecutor = Executors.newSingleThreadExecutor()

        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            try {
                val cameraProvider = cameraProviderFuture.get()
                bindCameraUseCases(cameraProvider)
            } catch (e: Exception) {
                setResult(RESULT_CANCELED, Intent().apply {
                    putExtra("error", "CAMERA_OPEN_FAILED")
                })
                finish()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun bindCameraUseCases(cameraProvider: ProcessCameraProvider) {
        // Preview use case
        val preview = Preview.Builder().build().also {
            it.setSurfaceProvider(previewView.surfaceProvider)
        }

        // Image analysis use case
        val imageAnalysis = ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()
            .also {
                it.setAnalyzer(cameraExecutor, BarcodeAnalyzer())
            }

        // Select camera (prefer back camera)
        val cameraSelector = CameraSelector.Builder()
            .requireLensFacing(CameraSelector.LENS_FACING_BACK)
            .build()

        try {
            cameraProvider.unbindAll()
            camera = cameraProvider.bindToLifecycle(
                this,
                cameraSelector,
                preview,
                imageAnalysis
            )
        } catch (e: Exception) {
            setResult(RESULT_CANCELED, Intent().apply {
                putExtra("error", "CAMERA_OPEN_FAILED")
            })
            finish()
        }
    }

    private inner class BarcodeAnalyzer : ImageAnalysis.Analyzer {
        private val scanner = BarcodeScanning.getClient()

        override fun analyze(imageProxy: ImageProxy) {
            if (!isScanning) {
                imageProxy.close()
                return
            }

            val mediaImage = imageProxy.image
            if (mediaImage != null) {
                val image = InputImage.fromMediaImage(
                    mediaImage,
                    imageProxy.imageInfo.rotationDegrees
                )

                scanner.process(image)
                    .addOnSuccessListener { barcodes ->
                        if (isScanning && barcodes.isNotEmpty()) {
                            handleScanResult(barcodes[0])
                        }
                    }
                    .addOnCompleteListener {
                        imageProxy.close()
                    }
            } else {
                imageProxy.close()
            }
        }
    }

    private fun handleScanResult(barcode: Barcode) {
        isScanning = false

        val result = barcode.rawValue ?: ""
        val format = when (barcode.format) {
            Barcode.FORMAT_QR_CODE -> "QR_CODE"
            Barcode.FORMAT_EAN_13 -> "EAN_13"
            Barcode.FORMAT_EAN_8 -> "EAN_8"
            Barcode.FORMAT_CODE_128 -> "CODE_128"
            Barcode.FORMAT_CODE_39 -> "CODE_39"
            Barcode.FORMAT_UPC_A -> "UPC_A"
            Barcode.FORMAT_UPC_E -> "UPC_E"
            else -> "UNKNOWN"
        }

        setResult(RESULT_OK, Intent().apply {
            putExtra(SCAN_RESULT, result)
            putExtra(SCAN_RESULT_FORMAT, format)
        })
        finish()
    }

    private fun dpToPx(dp: Int): Int {
        return (dp * resources.displayMetrics.density).toInt()
    }

    override fun onDestroy() {
        super.onDestroy()
        if (::cameraExecutor.isInitialized) {
            cameraExecutor.shutdown()
        }
    }
}
