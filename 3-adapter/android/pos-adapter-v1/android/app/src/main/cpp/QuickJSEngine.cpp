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

std::vector<uint8_t> QuickJSEngine::compileScript(const std::string& script) {
    if (!context_) {
        LOGE("Context not created");
        return {};
    }

    // Compile script to bytecode
    JSValue func = JS_Eval(
        context_,
        script.c_str(),
        script.length(),
        "<script>",
        JS_EVAL_FLAG_COMPILE_ONLY
    );

    if (JS_IsException(func)) {
        LOGE("Script compilation failed");
        extractError();
        JS_FreeValue(context_, func);
        return {};
    }

    // Serialize to bytecode
    size_t size;
    uint8_t* buf = JS_WriteObject(context_, &size, func, JS_WRITE_OBJ_BYTECODE);

    if (!buf) {
        LOGE("Failed to serialize bytecode");
        JS_FreeValue(context_, func);
        return {};
    }

    // Copy to vector
    std::vector<uint8_t> bytecode(buf, buf + size);

    // Free resources
    js_free(context_, buf);
    JS_FreeValue(context_, func);

    LOGI("Script compiled to bytecode (%zu bytes)", size);
    return bytecode;
}

} // namespace react
} // namespace facebook
