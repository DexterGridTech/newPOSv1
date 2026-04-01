package com.impos2.mixcretailrn84v2.loading

import android.app.Activity
import android.os.Bundle
import com.impos2.mixcretailrn84v2.R

class LoadingActivity : Activity() {

    companion object {
        const val EXTRA_MODE = "mode"
        const val MODE_LAUNCH = "launch"
        const val MODE_LOADING = "loading"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val mode = intent?.getStringExtra(EXTRA_MODE) ?: MODE_LAUNCH
        if (mode == MODE_LOADING) {
            setContentView(R.layout.loading_screen)
        } else {
            setContentView(R.layout.launch_screen)
        }
        LoadingManager.registerLoadingActivity(this)
    }

    override fun onDestroy() {
        super.onDestroy()
        LoadingManager.unregisterLoadingActivity(this)
    }
}
