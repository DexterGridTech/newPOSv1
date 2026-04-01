package com.impos2.adapter.dev.ui.console

object ConsoleSessionStore {
  data class ActivityItem(
    val module: String,
    val action: String,
    val status: String,
    val timestamp: Long,
  )

  private val recentActivities = ArrayDeque<ActivityItem>()
  private val latestStatus = linkedMapOf<String, String>()

  fun record(module: String, action: String, status: String, timestamp: Long = System.currentTimeMillis()) {
    latestStatus[module] = status
    recentActivities.addFirst(ActivityItem(module, action, status, timestamp))
    while (recentActivities.size > 6) {
      recentActivities.removeLast()
    }
  }

  fun getRecentActivities(): List<ActivityItem> = recentActivities.toList()

  fun getLatestStatus(module: String): String? = latestStatus[module]
}
