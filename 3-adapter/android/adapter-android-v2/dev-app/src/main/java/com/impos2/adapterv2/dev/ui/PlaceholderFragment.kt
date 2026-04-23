package com.impos2.adapterv2.dev.ui

import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import androidx.fragment.app.Fragment
import com.google.android.material.textview.MaterialTextView

class PlaceholderFragment : Fragment() {
  override fun onCreateView(
    inflater: android.view.LayoutInflater,
    container: ViewGroup?,
    savedInstanceState: Bundle?
  ): View {
    val title = arguments?.getString(ARG_TITLE) ?: "Unknown"
    return LinearLayout(requireContext()).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(32, 32, 32, 32)
      addView(MaterialTextView(requireContext()).apply {
        text = "$title 模块测试页待接入"
        textSize = 18f
      })
    }
  }

  companion object {
    private const val ARG_TITLE = "arg_title"

    fun newInstance(title: String): PlaceholderFragment {
      return PlaceholderFragment().apply {
        arguments = Bundle().apply { putString(ARG_TITLE, title) }
      }
    }
  }
}
