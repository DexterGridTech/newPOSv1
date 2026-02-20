package com.impos2desktopv1.base

import android.app.Activity
import android.content.Context

/**
 * Activity 上下文接口
 *
 * 职责：
 * 1. 抽象 Activity 的依赖
 * 2. 降低组件与具体 Activity 的耦合
 *
 * 设计原则：
 * - 依赖倒置：依赖接口而非具体实现
 * - 接口隔离：只暴露必要的方法
 */
interface ActivityContext {
    /**
     * 获取 Android Context
     */
    fun getContext(): Context

    /**
     * 获取 Activity 实例
     */
    fun getActivity(): Activity
}
