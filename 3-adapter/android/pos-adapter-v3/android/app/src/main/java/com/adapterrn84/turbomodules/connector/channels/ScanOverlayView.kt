package com.adapterrn84.turbomodules.connector.channels

import android.content.Context
import android.graphics.*
import android.view.View

/**
 * 扫码框自定义 View
 * 
 * - 扫描框大小: 260dp × 260dp
 * - 四角标记臂长: 20dp，描边: 3dp
 * - 使用 PorterDuff.Mode.CLEAR 挖空扫描框
 */
class ScanOverlayView(context: Context) : View(context) {

    private val maskPaint = Paint().apply {
        color = Color.parseColor("#80000000") // 半透明黑色
        style = Paint.Style.FILL
    }

    private val clearPaint = Paint().apply {
        xfermode = PorterDuffXfermode(PorterDuff.Mode.CLEAR)
    }

    private val cornerPaint = Paint().apply {
        color = Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = dpToPx(3f)
        strokeCap = Paint.Cap.ROUND
    }

    private val scanFrameSize = dpToPx(260f)
    private val cornerLength = dpToPx(20f)

    init {
        // Enable software layer for PorterDuff.Mode.CLEAR to work
        setLayerType(LAYER_TYPE_SOFTWARE, null)
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val width = width.toFloat()
        val height = height.toFloat()

        // Calculate scan frame position (centered)
        val left = (width - scanFrameSize) / 2
        val top = (height - scanFrameSize) / 2
        val right = left + scanFrameSize
        val bottom = top + scanFrameSize

        // Draw mask
        canvas.drawRect(0f, 0f, width, height, maskPaint)

        // Clear scan frame area
        canvas.drawRect(left, top, right, bottom, clearPaint)

        // Draw four corner marks
        // Top-left corner
        canvas.drawLine(left, top, left + cornerLength, top, cornerPaint)
        canvas.drawLine(left, top, left, top + cornerLength, cornerPaint)

        // Top-right corner
        canvas.drawLine(right - cornerLength, top, right, top, cornerPaint)
        canvas.drawLine(right, top, right, top + cornerLength, cornerPaint)

        // Bottom-left corner
        canvas.drawLine(left, bottom - cornerLength, left, bottom, cornerPaint)
        canvas.drawLine(left, bottom, left + cornerLength, bottom, cornerPaint)

        // Bottom-right corner
        canvas.drawLine(right, bottom - cornerLength, right, bottom, cornerPaint)
        canvas.drawLine(right - cornerLength, bottom, right, bottom, cornerPaint)
    }

    private fun dpToPx(dp: Float): Float {
        return dp * context.resources.displayMetrics.density
    }
}
