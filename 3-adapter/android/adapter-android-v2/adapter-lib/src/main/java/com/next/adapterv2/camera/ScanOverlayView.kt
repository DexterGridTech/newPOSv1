package com.next.adapterv2.camera

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RectF
import android.util.AttributeSet
import android.view.View

class ScanOverlayView @JvmOverloads constructor(
  context: Context,
  attrs: AttributeSet? = null
) : View(context, attrs) {

  companion object {
    private const val FRAME_SIZE_RATIO = 0.65f
    private const val CORNER_ARM_DP = 20f
    private const val CORNER_STROKE_DP = 3f
    private const val MASK_ALPHA = 0x99
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

  val frameRect = RectF()

  init {
    setLayerType(LAYER_TYPE_SOFTWARE, null)
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    val shortEdge = minOf(w, h).toFloat()
    val size = shortEdge * FRAME_SIZE_RATIO
    val cx = w / 2f
    val cy = h / 2f
    frameRect.set(cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2)
  }

  override fun onDraw(canvas: Canvas) {
    canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), maskPaint)
    canvas.drawRect(frameRect, clearPaint)
    drawCorners(canvas)
  }

  private fun drawCorners(canvas: Canvas) {
    val arm = CORNER_ARM_DP * density
    val l = frameRect.left
    val t = frameRect.top
    val r = frameRect.right
    val b = frameRect.bottom

    canvas.drawLine(l, t, l + arm, t, cornerPaint)
    canvas.drawLine(l, t, l, t + arm, cornerPaint)

    canvas.drawLine(r - arm, t, r, t, cornerPaint)
    canvas.drawLine(r, t, r, t + arm, cornerPaint)

    canvas.drawLine(l, b - arm, l, b, cornerPaint)
    canvas.drawLine(l, b, l + arm, b, cornerPaint)

    canvas.drawLine(r - arm, b, r, b, cornerPaint)
    canvas.drawLine(r, b - arm, r, b, cornerPaint)
  }
}
