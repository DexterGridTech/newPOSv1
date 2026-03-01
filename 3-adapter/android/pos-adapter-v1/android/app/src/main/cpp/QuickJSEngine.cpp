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

    // Clear interrupt flag
    interrupted_ = false;

    // Clear native functions
    nativeFunctions_.clear();

    LOGI("QuickJS engine reset for reuse");
}

void QuickJSEngine::setTimeout(uint32_t ms) {
    timeoutMs_ = ms;
    interrupted_ = false;
    startTime_ = std::chrono::steady_clock::now();
}

void QuickJSEngine::interrupt() {
    interrupted_ = true;
}

int QuickJSEngine::interruptHandler(JSRuntime* rt, void* opaque) {
    auto* engine = static_cast<QuickJSEngine*>(opaque);

    // Check manual interrupt flag
    if (engine->interrupted_) {
        LOGE("Script execution manually interrupted");
        return 1;
    }

    // Check timeout
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

void QuickJSEngine::setGlobalVariable(const std::string& name, const std::string& jsonValue) {
    if (!context_) {
        LOGE("Context not created");
        return;
    }

    // Parse JSON value
    JSValue value = JS_ParseJSON(
        context_,
        jsonValue.c_str(),
        jsonValue.length(),
        "<json>"
    );

    if (JS_IsException(value)) {
        LOGE("Failed to parse JSON for variable %s", name.c_str());
        extractError();
        return;
    }

    // Set as global variable
    JSValue global = JS_GetGlobalObject(context_);
    JS_SetPropertyStr(context_, global, name.c_str(), value);
    JS_FreeValue(context_, global);

    LOGI("Set global variable: %s", name.c_str());
}

JSValue QuickJSEngine::convertJSIValueToQuickJS(const jsi::Value& value) {
    if (value.isUndefined()) {
        return JS_UNDEFINED;
    }
    if (value.isNull()) {
        return JS_NULL;
    }
    if (value.isBool()) {
        return JS_NewBool(context_, value.getBool());
    }
    if (value.isNumber()) {
        return JS_NewFloat64(context_, value.getNumber());
    }

    // Check if we have a runtime available for string/object conversion
    if (nativeFunctions_.empty() || !nativeFunctions_[0]->runtime) {
        LOGE("No runtime available for type conversion");
        return JS_UNDEFINED;
    }

    if (value.isString()) {
        std::string str = value.getString(*nativeFunctions_[0]->runtime).utf8(*nativeFunctions_[0]->runtime);
        return JS_NewString(context_, str.c_str());
    }
    if (value.isObject()) {
        // Convert object to JSON string, then parse in QuickJS
        auto obj = value.getObject(*nativeFunctions_[0]->runtime);
        std::string json = jsi::Value(*nativeFunctions_[0]->runtime, obj)
            .toString(*nativeFunctions_[0]->runtime).utf8(*nativeFunctions_[0]->runtime);
        return JS_ParseJSON(context_, json.c_str(), json.length(), "<jsi>");
    }
    return JS_UNDEFINED;
}

jsi::Value QuickJSEngine::convertQuickJSValueToJSI(JSValue value) {
    if (!nativeFunctions_.empty() && nativeFunctions_[0]->runtime) {
        jsi::Runtime& rt = *nativeFunctions_[0]->runtime;

        if (JS_IsUndefined(value)) {
            return jsi::Value::undefined();
        }
        if (JS_IsNull(value)) {
            return jsi::Value::null();
        }
        if (JS_IsBool(value)) {
            return jsi::Value(JS_ToBool(context_, value) == 1);
        }
        if (JS_IsNumber(value)) {
            double num;
            JS_ToFloat64(context_, &num, value);
            return jsi::Value(num);
        }
        if (JS_IsString(value)) {
            const char* str = JS_ToCString(context_, value);
            jsi::Value result = jsi::String::createFromUtf8(rt, str);
            JS_FreeCString(context_, str);
            return result;
        }
        if (JS_IsObject(value)) {
            // Convert to JSON string, then parse in JSI
            JSValue json = JS_JSONStringify(context_, value, JS_UNDEFINED, JS_UNDEFINED);
            const char* jsonStr = JS_ToCString(context_, json);
            jsi::Value result = rt.global().getPropertyAsFunction(rt, "JSON")
                .getPropertyAsObject(rt, "parse")
                .asFunction(rt)
                .call(rt, jsi::String::createFromUtf8(rt, jsonStr));
            JS_FreeCString(context_, jsonStr);
            JS_FreeValue(context_, json);
            return result;
        }
    }
    return jsi::Value::undefined();
}

// Static callback for QuickJS
JSValue QuickJSEngine::nativeFunctionCallback(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv,
    int magic
) {
    auto* engine = static_cast<QuickJSEngine*>(JS_GetContextOpaque(ctx));
    if (!engine || magic >= static_cast<int>(engine->nativeFunctions_.size())) {
        JS_ThrowInternalError(ctx, "Invalid native function index");
        return JS_EXCEPTION;
    }

    auto& funcData = engine->nativeFunctions_[magic];

    // Convert arguments from QuickJS to JSI
    std::vector<jsi::Value> args;
    args.reserve(argc);
    for (int i = 0; i < argc; i++) {
        args.push_back(engine->convertQuickJSValueToJSI(argv[i]));
    }

    // Call JSI function
    jsi::Value result = funcData->func(
        *funcData->runtime,
        args.data(),
        args.size()
    );

    // Convert result back to QuickJS
    return engine->convertJSIValueToQuickJS(result);
}

void QuickJSEngine::registerNativeFunction(
    const std::string& name,
    std::function<jsi::Value(jsi::Runtime&, const jsi::Value*, size_t)> func,
    jsi::Runtime* runtime
) {
    if (!context_) {
        LOGE("Context not created");
        return;
    }

    // Store function data
    auto funcData = std::make_unique<NativeFunctionData>();
    funcData->func = std::move(func);
    funcData->runtime = runtime;
    int magic = nativeFunctions_.size();
    nativeFunctions_.push_back(std::move(funcData));

    // Set context opaque for callback access
    JS_SetContextOpaque(context_, this);

    // Create QuickJS function
    JSValue jsFunc = JS_NewCFunctionMagic(
        context_,
        nativeFunctionCallback,
        name.c_str(),
        0,  // length (variable args)
        JS_CFUNC_generic_magic,
        magic
    );

    // Set as global function
    JSValue global = JS_GetGlobalObject(context_);
    JS_SetPropertyStr(context_, global, name.c_str(), jsFunc);
    JS_FreeValue(context_, global);

    LOGI("Registered native function: %s", name.c_str());
}

} // namespace react
} // namespace facebook
