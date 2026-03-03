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
        private const val FRAME_SIZE_DP    = 260f
        private const val CORNER_ARM_DP    = 20f
        private const val CORNER_STROKE_DP = 3f
        private const val MASK_ALPHA       = 0x99 // ~60% 透明度
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
