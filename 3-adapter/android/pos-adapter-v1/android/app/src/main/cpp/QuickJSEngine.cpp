#include "QuickJSEngine.h"
#include <android/log.h>

#define LOG_TAG "QuickJSEngine"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace facebook {
namespace react {

QuickJSEngine::QuickJSEngine()
    : runtime_(nullptr),
      context_(nullptr),
      resultValue_(JS_UNDEFINED),
      hasError_(false),
      timeoutMs_(5000) {
    LOGI("QuickJSEngine created");
}

QuickJSEngine::~QuickJSEngine() {
    destroyContext();
    LOGI("QuickJSEngine destroyed");
}

void QuickJSEngine::destroyContext() {
    if (context_) {
        if (!JS_IsUndefined(resultValue_)) {
            JS_FreeValue(context_, resultValue_);
            resultValue_ = JS_UNDEFINED;
        }
        JS_FreeContext(context_);
        context_ = nullptr;
    }

    if (runtime_) {
        JS_FreeRuntime(runtime_);
        runtime_ = nullptr;
    }

    nativeFunctions_.clear();
    hasError_ = false;
    errorMessage_.clear();
    stackTrace_.clear();
}

bool QuickJSEngine::createContext() {
    // Create runtime
    runtime_ = JS_NewRuntime();
    if (!runtime_) {
        LOGE("Failed to create JSRuntime");
        return false;
    }

    // Set memory limit (64MB)
    JS_SetMemoryLimit(runtime_, 64 * 1024 * 1024);

    // Set interrupt handler for timeout
    JS_SetInterruptHandler(runtime_, interruptHandler, this);

    // Create context
    context_ = JS_NewContext(runtime_);
    if (!context_) {
        LOGE("Failed to create JSContext");
        JS_FreeRuntime(runtime_);
        runtime_ = nullptr;
        return false;
    }

    LOGI("QuickJS context created successfully");
    return true;
}

void QuickJSEngine::reset() {
    // Free result value
    if (!JS_IsUndefined(resultValue_)) {
        JS_FreeValue(context_, resultValue_);
        resultValue_ = JS_UNDEFINED;
    }

    // Clear error state
    hasError_ = false;
    errorMessage_.clear();
    stackTrace_.clear();

    // Clear native functions
    nativeFunctions_.clear();

    LOGI("QuickJS engine reset for reuse");
}

void QuickJSEngine::setTimeout(uint32_t ms) {
    timeoutMs_ = ms;
    startTime_ = std::chrono::steady_clock::now();
}

void QuickJSEngine::interrupt() {
    if (runtime_) {
        JS_SetInterruptHandler(runtime_, [](JSRuntime*, void*) { return 1; }, nullptr);
    }
}

int QuickJSEngine::interruptHandler(JSRuntime* rt, void* opaque) {
    auto* engine = static_cast<QuickJSEngine*>(opaque);
    auto now = std::chrono::steady_clock::now();
    auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
        now - engine->startTime_
    ).count();

    if (elapsed >= engine->timeoutMs_) {
        LOGE("Script execution timeout after %lld ms", elapsed);
        return 1;  // Interrupt execution
    }

    return 0;  // Continue execution
}

} // namespace react
} // namespace facebook
