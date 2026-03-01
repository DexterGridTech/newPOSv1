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

bool QuickJSEngine::executeFromBytecode(const std::vector<uint8_t>& bytecode) {
    if (!context_) {
        LOGE("Context not created");
        return false;
    }

    // Deserialize bytecode
    JSValue func = JS_ReadObject(
        context_,
        bytecode.data(),
        bytecode.size(),
        JS_READ_OBJ_BYTECODE
    );

    if (JS_IsException(func)) {
        LOGE("Failed to deserialize bytecode");
        extractError();
        return false;
    }

    // Execute function
    JSValue result = JS_EvalFunction(context_, func);

    if (JS_IsException(result)) {
        LOGE("Script execution failed");
        extractError();
        JS_FreeValue(context_, result);
        return false;
    }

    // Store result
    if (!JS_IsUndefined(resultValue_)) {
        JS_FreeValue(context_, resultValue_);
    }
    resultValue_ = result;

    LOGI("Script executed successfully from bytecode");
    return true;
}

bool QuickJSEngine::executeScript(const std::string& script) {
    if (!context_) {
        LOGE("Context not created");
        return false;
    }

    // Execute script directly
    JSValue result = JS_Eval(
        context_,
        script.c_str(),
        script.length(),
        "<script>",
        JS_EVAL_TYPE_GLOBAL
    );

    if (JS_IsException(result)) {
        LOGE("Script execution failed");
        extractError();
        return false;
    }

    // Store result
    if (!JS_IsUndefined(resultValue_)) {
        JS_FreeValue(context_, resultValue_);
    }
    resultValue_ = result;

    LOGI("Script executed successfully");
    return true;
}

void QuickJSEngine::extractError() {
    hasError_ = true;

    JSValue exception = JS_GetException(context_);

    // Get error message
    const char* str = JS_ToCString(context_, exception);
    if (str) {
        errorMessage_ = str;
        JS_FreeCString(context_, str);
    } else {
        errorMessage_ = "Unknown error";
    }

    // Get stack trace
    JSValue stack = JS_GetPropertyStr(context_, exception, "stack");
    if (!JS_IsUndefined(stack)) {
        const char* stackStr = JS_ToCString(context_, stack);
        if (stackStr) {
            stackTrace_ = stackStr;
            JS_FreeCString(context_, stackStr);
        }
        JS_FreeValue(context_, stack);
    }

    JS_FreeValue(context_, exception);

    LOGE("Error: %s", errorMessage_.c_str());
    if (!stackTrace_.empty()) {
        LOGE("Stack: %s", stackTrace_.c_str());
    }
}

std::string QuickJSEngine::getError() {
    return errorMessage_;
}

std::string QuickJSEngine::getStackTrace() {
    return stackTrace_;
}

bool QuickJSEngine::hasError() const {
    return hasError_;
}

std::string QuickJSEngine::getResult() {
    if (!context_ || JS_IsUndefined(resultValue_)) {
        return "null";
    }

    // Convert result to JSON string
    JSValue json = JS_JSONStringify(context_, resultValue_, JS_UNDEFINED, JS_UNDEFINED);

    if (JS_IsException(json)) {
        LOGE("Failed to stringify result");
        return "null";
    }

    const char* str = JS_ToCString(context_, json);
    std::string result = str ? str : "null";

    if (str) {
        JS_FreeCString(context_, str);
    }
    JS_FreeValue(context_, json);

    return result;
}

} // namespace react
} // namespace facebook
