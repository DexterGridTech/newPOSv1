package com.impos2.mixcretailrn84.loading

import android.app.Activity
import android.os.Bundle

class LoadingActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        LoadingManager.registerLoadingActivity(this)
    }

    override fun onDestroy() {
        super.onDestroy()
        LoadingManager.unregisterLoadingActivity(this)
    }
}
