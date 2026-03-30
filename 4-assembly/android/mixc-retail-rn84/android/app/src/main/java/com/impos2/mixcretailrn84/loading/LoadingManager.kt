package com.impos2.mixcretailrn84.loading

import android.app.Activity
import android.content.Intent
import java.lang.ref.WeakReference

object LoadingManager {
    private var loadingActivityRef: WeakReference<LoadingActivity>? = null

    fun showLoading(activity: Activity) {
        activity.startActivity(Intent(activity, LoadingActivity::class.java))
    }

    fun registerActivity(activity: LoadingActivity) {
        loadingActivityRef = WeakReference(activity)
    }

    fun hideLoading() {
        loadingActivityRef?.get()?.finish()
        loadingActivityRef = null
    }
}
