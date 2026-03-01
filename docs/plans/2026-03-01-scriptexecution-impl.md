# ScriptExecution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a high-performance JavaScript script execution module using JSI + QuickJS with bytecode caching

**Architecture:** Pure C++ TurboModule with JSI bridge, QuickJS engine wrapper, LRU bytecode cache, and engine pool for optimal performance

**Tech Stack:** React Native 0.84.1, JSI, C++ TurboModule, QuickJS, CMake

---

## Prerequisites

**Required Knowledge:**
- React Native 0.84.1 TurboModule architecture
- JSI (JavaScript Interface) API
- C++17 features (smart pointers, RAII, std::atomic)
- QuickJS C API
- CMake build system

**Reference Files:**
- Design doc: `docs/plans/2026-03-01-scriptexecution-design.md`
- Old implementation: `_old_/pos-adapter/src/foundations/scriptExecution.ts`
- Migration guide: `ai-result/pos-adapter-migration-guide.md`
- Existing TurboModule: `3-adapter/android/pos-adapter-v1/src/specs/NativeLoggerTurboModule.ts`

---

## Task 1: Create TurboModule Spec

**Files:**
- Create: `3-adapter/android/pos-adapter-v1/src/specs/NativeScriptsTurboModule.ts`

**Step 1: Create the Spec file**

```typescript
import type {TurboModule} from 'react-native'
import {TurboModuleRegistry} from 'react-native'

export interface Spec extends TurboModule {
    executeScript(
        script: string,
        paramsJson: string,
        globalsJson: string,
        nativeFuncNames: string[],
        timeout: number
    ): Promise<string>

    getStats(): Promise<{
        totalExecutions: number
        cacheHits: number
        cacheMisses: number
        cacheHitRate: number
    }>

    clearCache(): Promise<void>
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeScriptsTurboModule')
```

**Step 2: Verify the Spec compiles**

Run: `cd 3-adapter/android/pos-adapter-v1 && yarn tsc --noEmit`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/specs/NativeScriptsTurboModule.ts
git commit -m "feat(scriptexecution): add TurboModule spec

- Define executeScript method with JSON serialization
- Add getStats for cache statistics
- Add clearCache for cache management

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Copy QuickJS Source Files

**Files:**
- Create: `3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/quickjs/` (directory)
- Copy from: `_old_/pos-adapter/android/turbomodule-lib/src/main/cpp/quickjs/`

**Step 1: Create quickjs directory**

```bash
mkdir -p 3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/quickjs
```

**Step 2: Copy QuickJS source files**

```bash
cp _old_/pos-adapter/android/turbomodule-lib/src/main/cpp/quickjs/*.c \
   3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/quickjs/
cp _old_/pos-adapter/android/turbomodule-lib/src/main/cpp/quickjs/*.h \
   3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/quickjs/
```

**Step 3: Verify files copied**

Run: `ls -la 3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/quickjs/`
Expected: 13 files (quickjs.c, quickjs.h, libregexp.c, libregexp.h, libunicode.c, libunicode.h, dtoa.c, dtoa.h, and 5 more)

**Step 4: Commit**

```bash
git add android/app/src/main/cpp/quickjs/
git commit -m "feat(scriptexecution): add QuickJS engine source files

- Copy QuickJS 2024-01-13 release
- Includes quickjs.c/h, libregexp, libunicode, dtoa
- Total 13 C/H files for JS engine

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Create QuickJSEngine Header

**Files:**
- Create: `3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/QuickJSEngine.h`

**Step 1: Create the header file**

```cpp
#pragma once

#include <string>
#include <vector>
#include <functional>
#include <chrono>
#include <jsi/jsi.h>
#include "quickjs/quickjs.h"

namespace facebook {
namespace react {

class QuickJSEngine {
public:
    QuickJSEngine();
    ~QuickJSEngine();

    // Prevent copying
    QuickJSEngine(const QuickJSEngine&) = delete;
    QuickJSEngine& operator=(const QuickJSEngine&) = delete;

    // Context management
    bool createContext();
    void destroyContext();
    void reset();  // Reset for reuse

    // Script compilation and execution
    std::vector<uint8_t> compileScript(const std::string& script);
    bool executeFromBytecode(const std::vector<uint8_t>& bytecode);
    bool executeScript(const std::string& script);

    // Variable and function registration
    void setGlobalVariable(const std::string& name, const std::string& jsonValue);
    void registerNativeFunction(
        const std::string& name,
        std::function<jsi::Value(jsi::Runtime&, const jsi::Value*, size_t)> func,
        jsi::Runtime* runtime
    );

    // Result retrieval
    std::string getResult();
    std::string getError();
    std::string getStackTrace();
    bool hasError() const;

    // Timeout and interruption
    void setTimeout(uint32_t ms);
    void interrupt();

private:
    JSRuntime* runtime_;
    JSContext* context_;
    JSValue resultValue_;
    std::string errorMessage_;
    std::string stackTrace_;
    bool hasError_;

    // Timeout handling
    std::chrono::steady_clock::time_point startTime_;
    uint32_t timeoutMs_;

    // Native function storage
    struct NativeFunctionData {
        std::function<jsi::Value(jsi::Runtime&, const jsi::Value*, size_t)> func;
        jsi::Runtime* runtime;
    };
    std::vector<std::unique_ptr<NativeFunctionData>> nativeFunctions_;

    // Helper methods
    static int interruptHandler(JSRuntime* rt, void* opaque);
    JSValue convertJSIValueToQuickJS(const jsi::Value& value);
    jsi::Value convertQuickJSValueToJSI(JSValue value);
    void extractError();
};

} // namespace react
} // namespace facebook
```

**Step 2: Commit**

```bash
git add android/app/src/main/cpp/QuickJSEngine.h
git commit -m "feat(scriptexecution): add QuickJSEngine header

- Define QuickJS wrapper class interface
- Support bytecode compilation and execution
- Support native function registration via JSI
- Include timeout and error handling

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Implement QuickJSEngine Constructor and Destructor

**Files:**
- Create: `3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/QuickJSEngine.cpp`

**Step 1: Create implementation file with constructor**

```cpp
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

} // namespace react
} // namespace facebook
```

**Step 2: Commit**

```bash
git add android/app/src/main/cpp/QuickJSEngine.cpp
git commit -m "feat(scriptexecution): implement QuickJSEngine lifecycle

- Add constructor and destructor
- Implement destroyContext with proper cleanup
- Add Android logging support

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Implement Context Creation

**Files:**
- Modify: `3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/QuickJSEngine.cpp`

**Step 1: Add createContext and reset methods**

```cpp
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
```

**Step 2: Commit**

```bash
git add android/app/src/main/cpp/QuickJSEngine.cpp
git commit -m "feat(scriptexecution): implement context creation

- Create JSRuntime with 64MB memory limit
- Create JSContext with interrupt handler
- Implement reset() for engine reuse

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Implement Timeout Interrupt Handler

**Files:**
- Modify: `3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/QuickJSEngine.cpp`

**Step 1: Add timeout methods**

```cpp
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
```

**Step 2: Commit**

```bash
git add android/app/src/main/cpp/QuickJSEngine.cpp
git commit -m "feat(scriptexecution): implement timeout mechanism

- Add setTimeout to configure timeout duration
- Implement interrupt handler checking elapsed time
- Support manual interrupt() call

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Implement Script Compilation

**Files:**
- Modify: `3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/QuickJSEngine.cpp`

**Step 1: Add compileScript method**

```cpp
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
```

**Step 2: Commit**

```bash
git add android/app/src/main/cpp/QuickJSEngine.cpp
git commit -m "feat(scriptexecution): implement script compilation

- Compile script to bytecode using JS_Eval
- Serialize bytecode using JS_WriteObject
- Return bytecode as std::vector<uint8_t>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Implement Bytecode Execution

**Files:**
- Modify: `3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/QuickJSEngine.cpp`

**Step 1: Add executeFromBytecode method**

```cpp
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
```

**Step 2: Add executeScript method**

```cpp
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
```

**Step 3: Commit**

```bash
git add android/app/src/main/cpp/QuickJSEngine.cpp
git commit -m "feat(scriptexecution): implement script execution

- Add executeFromBytecode for cached execution
- Add executeScript for direct execution
- Store result value for later retrieval

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Implement Error Extraction

**Files:**
- Modify: `3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/QuickJSEngine.cpp`

**Step 1: Add extractError method**

```cpp
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
```

**Step 2: Add getter methods**

```cpp
std::string QuickJSEngine::getError() {
    return errorMessage_;
}

std::string QuickJSEngine::getStackTrace() {
    return stackTrace_;
}

bool QuickJSEngine::hasError() const {
    return hasError_;
}
```

**Step 3: Commit**

```bash
git add android/app/src/main/cpp/QuickJSEngine.cpp
git commit -m "feat(scriptexecution): implement error extraction

- Extract error message from exception
- Extract stack trace from exception
- Add getter methods for error info

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 10: Implement Result Retrieval

**Files:**
- Modify: `3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/QuickJSEngine.cpp`

**Step 1: Add getResult method**

```cpp
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
```

**Step 2: Commit**

```bash
git add android/app/src/main/cpp/QuickJSEngine.cpp
git commit -m "feat(scriptexecution): implement result retrieval

- Convert result to JSON string using JS_JSONStringify
- Return \"null\" for undefined results
- Handle stringify errors gracefully

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 11: Implement Global Variable Setting

**Files:**
- Modify: `3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/QuickJSEngine.cpp`

**Step 1: Add setGlobalVariable method**

```cpp
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
```

**Step 2: Commit**

```bash
git add android/app/src/main/cpp/QuickJSEngine.cpp
git commit -m "feat(scriptexecution): implement global variable setting

- Parse JSON value using JS_ParseJSON
- Set as property on global object
- Handle parse errors gracefully

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 12: Implement JSI to QuickJS Type Conversion

**Files:**
- Modify: `3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/QuickJSEngine.cpp`

**Step 1: Add convertJSIValueToQuickJS method**

```cpp
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
```

**Step 2: Commit**

```bash
git add android/app/src/main/cpp/QuickJSEngine.cpp
git commit -m "feat(scriptexecution): implement JSI to QuickJS conversion

- Convert JSI primitives to QuickJS JSValue
- Handle undefined, null, bool, number, string
- Convert objects via JSON serialization

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 13: Implement QuickJS to JSI Type Conversion

**Files:**
- Modify: `3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/QuickJSEngine.cpp`

**Step 1: Add convertQuickJSValueToJSI method**

```cpp
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
```

**Step 2: Commit**

```bash
git add android/app/src/main/cpp/QuickJSEngine.cpp
git commit -m "feat(scriptexecution): implement QuickJS to JSI conversion

- Convert QuickJS JSValue to JSI Value
- Handle all primitive types
- Convert objects via JSON serialization

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 14: Implement Native Function Registration

**Files:**
- Modify: `3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/QuickJSEngine.cpp`

**Step 1: Add native function callback wrapper**

```cpp
// Static callback for QuickJS
static JSValue nativeFunctionCallback(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv,
    int magic,
    JSValue* func_data
) {
    auto* engine = static_cast<QuickJSEngine*>(JS_GetContextOpaque(ctx));
    if (!engine || magic >= engine->nativeFunctions_.size()) {
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
```

**Step 2: Add registerNativeFunction method**

```cpp
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
```

**Step 3: Commit**

```bash
git add android/app/src/main/cpp/QuickJSEngine.cpp
git commit -m "feat(scriptexecution): implement native function registration

- Add nativeFunctionCallback for QuickJS C function
- Implement registerNativeFunction with JSI bridge
- Convert arguments bidirectionally (JSI ↔ QuickJS)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 15: Create ScriptExecutionModule Header

**Files:**
- Create: `3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/ScriptExecutionModule.h`

**Step 1: Create the header file**

```cpp
#pragma once

#include <ReactCommon/TurboModule.h>
#include <jsi/jsi.h>
#include <memory>
#include <unordered_map>
#include <vector>
#include <mutex>
#include "QuickJSEngine.h"

namespace facebook {
namespace react {

class ScriptExecutionModule : public TurboModule {
public:
    explicit ScriptExecutionModule(std::shared_ptr<CallInvoker> jsInvoker);
    ~ScriptExecutionModule() override;

    // TurboModule methods
    jsi::Value executeScript(
        jsi::Runtime& rt,
        const jsi::String& script,
        const jsi::String& paramsJson,
        const jsi::String& globalsJson,
        const jsi::Array& nativeFuncNames,
        double timeout
    );

    jsi::Object getStats(jsi::Runtime& rt);
    void clearCache(jsi::Runtime& rt);

private:
    // Bytecode cache
    struct CacheEntry {
        std::vector<uint8_t> bytecode;
        uint64_t lastUsed;
        uint32_t useCount;
    };
    std::unordered_map<std::string, CacheEntry> bytecodeCache_;
    std::mutex cacheMutex_;
    static constexpr size_t MAX_CACHE_SIZE = 100;

    // Engine pool
    std::vector<std::unique_ptr<QuickJSEngine>> enginePool_;
    std::mutex poolMutex_;
    static constexpr size_t POOL_SIZE = 3;

    // Statistics
    std::atomic<uint64_t> totalExecutions_{0};
    std::atomic<uint64_t> cacheHits_{0};
    std::atomic<uint64_t> cacheMisses_{0};

    // Helper methods
    std::string computeScriptHash(const std::string& script);
    QuickJSEngine* acquireEngine();
    void releaseEngine(QuickJSEngine* engine);
    void evictLRUCache();
    void updateCacheEntry(const std::string& hash);
};

} // namespace react
} // namespace facebook
```

**Step 2: Commit**

```bash
git add android/app/src/main/cpp/ScriptExecutionModule.h
git commit -m "feat(scriptexecution): add ScriptExecutionModule header

- Define TurboModule interface
- Add bytecode cache with LRU eviction
- Add engine pool (3 instances)
- Include execution statistics

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 16: Implement ScriptExecutionModule Constructor and Engine Pool

**Files:**
- Create: `3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/ScriptExecutionModule.cpp`

**Step 1: Create implementation file with constructor**

```cpp
#include "ScriptExecutionModule.h"
#include <openssl/sha.h>
#include <sstream>
#include <iomanip>
#include <android/log.h>

#define LOG_TAG "ScriptExecutionModule"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace facebook {
namespace react {

ScriptExecutionModule::ScriptExecutionModule(std::shared_ptr<CallInvoker> jsInvoker)
    : TurboModule("NativeScriptsTurboModule", jsInvoker) {
    // Initialize engine pool
    for (size_t i = 0; i < POOL_SIZE; i++) {
        auto engine = std::make_unique<QuickJSEngine>();
        if (engine->createContext()) {
            enginePool_.push_back(std::move(engine));
        } else {
            LOGE("Failed to create engine %zu", i);
        }
    }
    LOGI("ScriptExecutionModule initialized with %zu engines", enginePool_.size());
}

ScriptExecutionModule::~ScriptExecutionModule() {
    std::lock_guard<std::mutex> lock(poolMutex_);
    enginePool_.clear();
    LOGI("ScriptExecutionModule destroyed");
}

} // namespace react
} // namespace facebook
```

**Step 2: Commit**

```bash
git add android/app/src/main/cpp/ScriptExecutionModule.cpp
git commit -m "feat(scriptexecution): implement module constructor

- Initialize engine pool with 3 QuickJS engines
- Add destructor for cleanup
- Include OpenSSL for SHA256 hashing

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 17: Implement Engine Pool Management

**Files:**
- Modify: `3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/ScriptExecutionModule.cpp`

**Step 1: Add acquireEngine and releaseEngine methods**

```cpp
QuickJSEngine* ScriptExecutionModule::acquireEngine() {
    std::lock_guard<std::mutex> lock(poolMutex_);
    
    if (enginePool_.empty()) {
        LOGE("Engine pool exhausted");
        return nullptr;
    }
    
    // Take engine from pool
    auto engine = std::move(enginePool_.back());
    enginePool_.pop_back();
    
    LOGI("Acquired engine, %zu remaining in pool", enginePool_.size());
    return engine.release();
}

void ScriptExecutionModule::releaseEngine(QuickJSEngine* engine) {
    if (!engine) return;
    
    std::lock_guard<std::mutex> lock(poolMutex_);
    
    // Reset engine for reuse
    engine->reset();
    
    // Return to pool
    enginePool_.push_back(std::unique_ptr<QuickJSEngine>(engine));
    
    LOGI("Released engine, %zu in pool", enginePool_.size());
}
```

**Step 2: Commit**

```bash
git add android/app/src/main/cpp/ScriptExecutionModule.cpp
git commit -m "feat(scriptexecution): implement engine pool management

- Add acquireEngine to get engine from pool
- Add releaseEngine to return engine after use
- Reset engine state before returning to pool

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 18: Implement Script Hash Computation

**Files:**
- Modify: `3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/ScriptExecutionModule.cpp`

**Step 1: Add computeScriptHash method**

```cpp
std::string ScriptExecutionModule::computeScriptHash(const std::string& script) {
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256(reinterpret_cast<const unsigned char*>(script.c_str()), 
           script.length(), 
           hash);
    
    std::stringstream ss;
    for (int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
        ss << std::hex << std::setw(2) << std::setfill('0') 
           << static_cast<int>(hash[i]);
    }
    
    return ss.str();
}
```

**Step 2: Commit**

```bash
git add android/app/src/main/cpp/ScriptExecutionModule.cpp
git commit -m "feat(scriptexecution): implement script hash computation

- Use SHA256 for cache key generation
- Convert hash to hex string
- Ensure unique cache keys for scripts

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 19: Implement Bytecode Cache with LRU

**Files:**
- Modify: `3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/ScriptExecutionModule.cpp`

**Step 1: Add cache management methods**

```cpp
void ScriptExecutionModule::evictLRUCache() {
    if (bytecodeCache_.size() < MAX_CACHE_SIZE) {
        return;
    }
    
    // Find LRU entry
    std::string lruKey;
    uint64_t oldestTime = UINT64_MAX;
    
    for (const auto& [key, entry] : bytecodeCache_) {
        if (entry.lastUsed < oldestTime) {
            oldestTime = entry.lastUsed;
            lruKey = key;
        }
    }
    
    if (!lruKey.empty()) {
        bytecodeCache_.erase(lruKey);
        LOGI("Evicted LRU cache entry: %s", lruKey.substr(0, 8).c_str());
    }
}

void ScriptExecutionModule::updateCacheEntry(const std::string& hash) {
    auto it = bytecodeCache_.find(hash);
    if (it != bytecodeCache_.end()) {
        it->second.lastUsed = std::chrono::steady_clock::now().time_since_epoch().count();
        it->second.useCount++;
    }
}
```

**Step 2: Commit**

```bash
git add android/app/src/main/cpp/ScriptExecutionModule.cpp
git commit -m "feat(scriptexecution): implement LRU cache eviction

- Evict oldest entry when cache is full
- Update lastUsed timestamp on cache hit
- Track use count for statistics

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 20: Implement executeScript Method (Part 1 - Setup)

**Files:**
- Modify: `3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/ScriptExecutionModule.cpp`

**Step 1: Add executeScript method skeleton**

```cpp
jsi::Value ScriptExecutionModule::executeScript(
    jsi::Runtime& rt,
    const jsi::String& script,
    const jsi::String& paramsJson,
    const jsi::String& globalsJson,
    const jsi::Array& nativeFuncNames,
    double timeout
) {
    totalExecutions_++;
    
    std::string scriptStr = script.utf8(rt);
    std::string paramsStr = paramsJson.utf8(rt);
    std::string globalsStr = globalsJson.utf8(rt);
    
    // Compute script hash for caching
    std::string hash = computeScriptHash(scriptStr);
    
    // Acquire engine from pool
    QuickJSEngine* engine = acquireEngine();
    if (!engine) {
        return jsi::String::createFromUtf8(rt, 
            R"({"success":false,"error":"ENGINE_POOL_EXHAUSTED","message":"No available engines"})");
    }
    
    // Set timeout
    engine->setTimeout(static_cast<uint32_t>(timeout));
    
    // Continue in next step...
    return jsi::Value::undefined();
}
```

**Step 2: Commit**

```bash
git add android/app/src/main/cpp/ScriptExecutionModule.cpp
git commit -m "feat(scriptexecution): add executeScript skeleton

- Extract parameters from JSI
- Compute script hash for caching
- Acquire engine from pool
- Set execution timeout

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 21: Implement executeScript Method (Part 2 - Cache & Execution)

**Files:**
- Modify: `3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/ScriptExecutionModule.cpp`

**Step 1: Complete executeScript implementation**

```cpp
jsi::Value ScriptExecutionModule::executeScript(
    jsi::Runtime& rt,
    const jsi::String& script,
    const jsi::String& paramsJson,
    const jsi::String& globalsJson,
    const jsi::Array& nativeFuncNames,
    double timeout
) {
    totalExecutions_++;
    
    std::string scriptStr = script.utf8(rt);
    std::string paramsStr = paramsJson.utf8(rt);
    std::string globalsStr = globalsJson.utf8(rt);
    
    std::string hash = computeScriptHash(scriptStr);
    
    QuickJSEngine* engine = acquireEngine();
    if (!engine) {
        return jsi::String::createFromUtf8(rt, 
            R"({"success":false,"error":"ENGINE_POOL_EXHAUSTED"})");
    }
    
    engine->setTimeout(static_cast<uint32_t>(timeout));
    
    // Register native functions
    size_t funcCount = nativeFuncNames.size(rt);
    for (size_t i = 0; i < funcCount; i++) {
        std::string funcName = nativeFuncNames.getValueAtIndex(rt, i).getString(rt).utf8(rt);
        
        // Create JSI HostFunction wrapper
        auto hostFunc = [funcName](
            jsi::Runtime& runtime,
            const jsi::Value& thisVal,
            const jsi::Value* args,
            size_t count
        ) -> jsi::Value {
            // Call native function via global registry
            auto func = runtime.global().getPropertyAsFunction(runtime, funcName.c_str());
            return func.call(runtime, args, count);
        };
        
        engine->registerNativeFunction(funcName, 
            [hostFunc](jsi::Runtime& rt, const jsi::Value* args, size_t count) {
                return hostFunc(rt, jsi::Value::undefined(), args, count);
            }, 
            &rt);
    }
    
    // Set global variables
    if (!globalsStr.empty() && globalsStr != "{}") {
        // Parse globals JSON and set each variable
        // Simplified: assume globals is {"key": "value"} format
        engine->setGlobalVariable("__globals", globalsStr);
    }
    
    // Set params
    if (!paramsStr.empty() && paramsStr != "{}") {
        engine->setGlobalVariable("params", paramsStr);
    }
    
    // Check cache
    bool success = false;
    {
        std::lock_guard<std::mutex> lock(cacheMutex_);
        auto it = bytecodeCache_.find(hash);
        
        if (it != bytecodeCache_.end()) {
            // Cache hit
            cacheHits_++;
            updateCacheEntry(hash);
            success = engine->executeFromBytecode(it->second.bytecode);
            LOGI("Cache hit for script %s", hash.substr(0, 8).c_str());
        } else {
            // Cache miss - compile and cache
            cacheMisses_++;
            auto bytecode = engine->compileScript(scriptStr);
            
            if (!bytecode.empty()) {
                // Store in cache
                evictLRUCache();
                CacheEntry entry;
                entry.bytecode = bytecode;
                entry.lastUsed = std::chrono::steady_clock::now().time_since_epoch().count();
                entry.useCount = 1;
                bytecodeCache_[hash] = std::move(entry);
                
                // Execute
                success = engine->executeFromBytecode(bytecode);
                LOGI("Cache miss, compiled and cached script %s", hash.substr(0, 8).c_str());
            }
        }
    }
    
    // Get result
    std::string resultJson;
    if (success && !engine->hasError()) {
        std::string result = engine->getResult();
        resultJson = R"({"success":true,"result":)" + result + "}";
    } else {
        std::string error = engine->getError();
        std::string stack = engine->getStackTrace();
        resultJson = R"({"success":false,"error":"EXECUTION_ERROR","message":")" + 
                     error + R"(","stack":")" + stack + R"("})";
    }
    
    // Release engine back to pool
    releaseEngine(engine);
    
    return jsi::String::createFromUtf8(rt, resultJson);
}
```

**Step 2: Commit**

```bash
git add android/app/src/main/cpp/ScriptExecutionModule.cpp
git commit -m "feat(scriptexecution): complete executeScript implementation

- Register native functions via JSI HostFunction
- Set global variables and params
- Check bytecode cache (hit/miss)
- Compile and cache on miss
- Execute from bytecode
- Return JSON result with success/error

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 22: Implement getStats and clearCache Methods

**Files:**
- Modify: `3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/ScriptExecutionModule.cpp`

**Step 1: Add getStats method**

```cpp
jsi::Object ScriptExecutionModule::getStats(jsi::Runtime& rt) {
    jsi::Object stats(rt);
    
    uint64_t total = totalExecutions_.load();
    uint64_t hits = cacheHits_.load();
    uint64_t misses = cacheMisses_.load();
    
    stats.setProperty(rt, "totalExecutions", jsi::Value(static_cast<double>(total)));
    stats.setProperty(rt, "cacheHits", jsi::Value(static_cast<double>(hits)));
    stats.setProperty(rt, "cacheMisses", jsi::Value(static_cast<double>(misses)));
    
    double hitRate = total > 0 ? (static_cast<double>(hits) / total) : 0.0;
    stats.setProperty(rt, "cacheHitRate", jsi::Value(hitRate));
    
    return stats;
}
```

**Step 2: Add clearCache method**

```cpp
void ScriptExecutionModule::clearCache(jsi::Runtime& rt) {
    std::lock_guard<std::mutex> lock(cacheMutex_);
    bytecodeCache_.clear();
    LOGI("Bytecode cache cleared");
}
```

**Step 3: Commit**

```bash
git add android/app/src/main/cpp/ScriptExecutionModule.cpp
git commit -m "feat(scriptexecution): implement stats and cache management

- Add getStats to return execution statistics
- Calculate cache hit rate
- Add clearCache to flush bytecode cache

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 23: Create TurboModule Registration

**Files:**
- Create: `3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/ScriptExecutionModuleJSI.cpp`

**Step 1: Create JSI binding file**

```cpp
#include "ScriptExecutionModule.h"
#include <ReactCommon/TurboModuleUtils.h>

namespace facebook {
namespace react {

static jsi::Value __hostFunction_ScriptExecutionModule_executeScript(
    jsi::Runtime& rt,
    TurboModule& turboModule,
    const jsi::Value* args,
    size_t count
) {
    auto& module = static_cast<ScriptExecutionModule&>(turboModule);
    return module.executeScript(
        rt,
        args[0].getString(rt),
        args[1].getString(rt),
        args[2].getString(rt),
        args[3].getObject(rt).getArray(rt),
        args[4].getNumber()
    );
}

static jsi::Value __hostFunction_ScriptExecutionModule_getStats(
    jsi::Runtime& rt,
    TurboModule& turboModule,
    const jsi::Value* args,
    size_t count
) {
    auto& module = static_cast<ScriptExecutionModule&>(turboModule);
    return module.getStats(rt);
}

static jsi::Value __hostFunction_ScriptExecutionModule_clearCache(
    jsi::Runtime& rt,
    TurboModule& turboModule,
    const jsi::Value* args,
    size_t count
) {
    auto& module = static_cast<ScriptExecutionModule&>(turboModule);
    module.clearCache(rt);
    return jsi::Value::undefined();
}

ScriptExecutionModule::ScriptExecutionModule(std::shared_ptr<CallInvoker> jsInvoker)
    : TurboModule("NativeScriptsTurboModule", jsInvoker) {
    methodMap_["executeScript"] = MethodMetadata{5, __hostFunction_ScriptExecutionModule_executeScript};
    methodMap_["getStats"] = MethodMetadata{0, __hostFunction_ScriptExecutionModule_getStats};
    methodMap_["clearCache"] = MethodMetadata{0, __hostFunction_ScriptExecutionModule_clearCache};
}

} // namespace react
} // namespace facebook
```

**Step 2: Commit**

```bash
git add android/app/src/main/cpp/ScriptExecutionModuleJSI.cpp
git commit -m "feat(scriptexecution): add TurboModule JSI bindings

- Create host functions for each method
- Register methods in methodMap
- Enable JSI bridge for TurboModule

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---


## Task 24: Configure CMakeLists.txt

**Files:**
- Modify: `3-adapter/android/pos-adapter-v1/android/app/src/main/cpp/CMakeLists.txt`

**Step 1: Add QuickJS and ScriptExecution to CMake**

```cmake
# Add QuickJS source files
file(GLOB QUICKJS_SRC
    "${CMAKE_CURRENT_SOURCE_DIR}/quickjs/*.c"
)

# Add ScriptExecution module
add_library(scriptexecution_module STATIC
    QuickJSEngine.cpp
    ScriptExecutionModule.cpp
    ScriptExecutionModuleJSI.cpp
    ${QUICKJS_SRC}
)

target_include_directories(scriptexecution_module PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/quickjs
    ${REACT_NATIVE_DIR}/ReactCommon
    ${REACT_NATIVE_DIR}/ReactCommon/jsi
    ${REACT_NATIVE_DIR}/ReactCommon/callinvoker
    ${REACT_NATIVE_DIR}/ReactAndroid/src/main/jni/react/turbomodule
)

target_link_libraries(scriptexecution_module
    ReactAndroid::jsi
    ReactAndroid::reactnativejni
    ReactAndroid::turbomodulejsijni
    crypto  # OpenSSL for SHA256
    log
)

# Link to main app
target_link_libraries(${CMAKE_PROJECT_NAME}
    scriptexecution_module
)
```

**Step 2: Verify CMake configuration**

Run: `cd 3-adapter/android/pos-adapter-v1/android && ./gradlew :app:configureCMakeDebug[arm64-v8a]`
Expected: CMake configuration succeeds

**Step 3: Commit**

```bash
git add android/app/src/main/cpp/CMakeLists.txt
git commit -m "feat(scriptexecution): configure CMake build

- Add QuickJS source files to build
- Create scriptexecution_module static library
- Link OpenSSL crypto for SHA256
- Link to main app target

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 25: Create TypeScript Adapter Implementation

**Files:**
- Create: `3-adapter/android/pos-adapter-v1/src/foundations/scriptExecution.ts`

**Step 1: Create adapter implementation**

```typescript
import {ScriptsExecution, ScriptExecutionError, ScriptExecutionResult} from '@mono/kernel-core-base'
import NativeScriptsTurboModule from '../specs/NativeScriptsTurboModule'

export const scriptExecution: ScriptsExecution = {
    async executeScript(
        script: string,
        params?: Record<string, any>,
        globals?: Record<string, any>,
        nativeFunctions?: string[],
        timeout?: number
    ): Promise<ScriptExecutionResult> {
        // Validate inputs
        if (!script || typeof script !== 'string') {
            throw new ScriptExecutionError(
                'INVALID_SCRIPT',
                'Script must be a non-empty string'
            )
        }

        // Serialize parameters
        const paramsJson = params ? JSON.stringify(params) : '{}'
        const globalsJson = globals ? JSON.stringify(globals) : '{}'
        const nativeFuncNames = nativeFunctions || []
        const timeoutMs = timeout || 5000

        try {
            // Call native module
            const resultJson = await NativeScriptsTurboModule.executeScript(
                script,
                paramsJson,
                globalsJson,
                nativeFuncNames,
                timeoutMs
            )

            // Parse result
            const result = JSON.parse(resultJson)

            if (result.success) {
                return {
                    success: true,
                    result: result.result
                }
            } else {
                throw new ScriptExecutionError(
                    result.error || 'EXECUTION_ERROR',
                    result.message || 'Script execution failed',
                    result.stack
                )
            }
        } catch (error) {
            if (error instanceof ScriptExecutionError) {
                throw error
            }
            throw new ScriptExecutionError(
                'NATIVE_ERROR',
                error instanceof Error ? error.message : 'Unknown error'
            )
        }
    },

    async getExecutionStats() {
        const stats = await NativeScriptsTurboModule.getStats()
        return {
            totalExecutions: stats.totalExecutions,
            cacheHits: stats.cacheHits,
            cacheMisses: stats.cacheMisses,
            cacheHitRate: stats.cacheHitRate
        }
    },

    async clearCache() {
        await NativeScriptsTurboModule.clearCache()
    }
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd 3-adapter/android/pos-adapter-v1 && yarn tsc --noEmit`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/foundations/scriptExecution.ts
git commit -m "feat(scriptexecution): implement TypeScript adapter

- Implement ScriptsExecution interface
- Validate inputs and serialize parameters
- Parse native module results
- Wrap errors in ScriptExecutionError
- Expose stats and cache management

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 26: Register Adapter in Module Setup

**Files:**
- Modify: `3-adapter/android/pos-adapter-v1/src/application/modulePreSetup.ts`

**Step 1: Import and register scriptExecution adapter**

```typescript
import {scriptExecution} from '../foundations/scriptExecution'
import {registerAdapter} from '@mono/kernel-core-base'

export const modulePreSetup = () => {
    // Register scriptExecution adapter
    registerAdapter('scriptExecution', scriptExecution)
    
    // ... other adapter registrations
}
```

**Step 2: Commit**

```bash
git add src/application/modulePreSetup.ts
git commit -m "feat(scriptexecution): register adapter in module setup

- Import scriptExecution adapter
- Register with kernel core base
- Enable adapter injection for business logic layer

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 27: Create Test UI Screen

**Files:**
- Create: `3-adapter/android/pos-adapter-v1/dev/screens/ScriptExecutionScreen.tsx`

**Step 1: Create test UI with preset scripts (Part 1 - Setup)**

```typescript
import React, {useState} from 'react'
import {View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet} from 'react-native'
import {scriptExecution} from '../../src/foundations/scriptExecution'

const PRESET_SCRIPTS = [
    {
        name: 'Basic Math',
        script: 'const result = params.a + params.b; result',
        params: {a: 10, b: 20},
        globals: {},
        nativeFunctions: []
    },
    {
        name: 'Global Variables',
        script: 'const sum = __globals.x + __globals.y; sum * 2',
        params: {},
        globals: {x: 5, y: 15},
        nativeFunctions: []
    },
    {
        name: 'Native Function',
        script: 'const data = getNativeData(); data.value * 3',
        params: {},
        globals: {},
        nativeFunctions: ['getNativeData']
    },
    {
        name: 'Fibonacci',
        script: `
function fib(n) {
    if (n <= 1) return n;
    return fib(n - 1) + fib(n - 2);
}
fib(params.n)
        `,
        params: {n: 10},
        globals: {},
        nativeFunctions: []
    },
    {
        name: 'Timeout Test',
        script: 'while(true) {}',
        params: {},
        globals: {},
        nativeFunctions: []
    }
]

export const ScriptExecutionScreen = () => {
    const [script, setScript] = useState(PRESET_SCRIPTS[0].script)
    const [params, setParams] = useState(JSON.stringify(PRESET_SCRIPTS[0].params, null, 2))
    const [globals, setGlobals] = useState(JSON.stringify(PRESET_SCRIPTS[0].globals, null, 2))
    const [nativeFunctions, setNativeFunctions] = useState('')
    const [timeout, setTimeout] = useState('5000')
    const [result, setResult] = useState('')
    const [stats, setStats] = useState<any>(null)
    const [history, setHistory] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    // Continue in next step...
    return <View />
}
```

**Step 2: Add execution logic**

```typescript
const executeScript = async () => {
    setLoading(true)
    setResult('')
    
    try {
        const startTime = Date.now()
        
        const execResult = await scriptExecution.executeScript(
            script,
            JSON.parse(params || '{}'),
            JSON.parse(globals || '{}'),
            nativeFunctions.split(',').map(f => f.trim()).filter(Boolean),
            parseInt(timeout, 10)
        )
        
        const duration = Date.now() - startTime
        
        setResult(JSON.stringify(execResult, null, 2))
        
        // Add to history
        setHistory(prev => [{
            timestamp: new Date().toISOString(),
            duration,
            success: execResult.success,
            result: execResult.result
        }, ...prev].slice(0, 20))
        
        // Update stats
        const newStats = await scriptExecution.getExecutionStats()
        setStats(newStats)
    } catch (error: any) {
        setResult(JSON.stringify({
            success: false,
            error: error.code || 'ERROR',
            message: error.message,
            stack: error.stack
        }, null, 2))
    } finally {
        setLoading(false)
    }
}

const loadPreset = (index: number) => {
    const preset = PRESET_SCRIPTS[index]
    setScript(preset.script)
    setParams(JSON.stringify(preset.params, null, 2))
    setGlobals(JSON.stringify(preset.globals, null, 2))
    setNativeFunctions(preset.nativeFunctions.join(', '))
}

const clearCache = async () => {
    await scriptExecution.clearCache()
    const newStats = await scriptExecution.getExecutionStats()
    setStats(newStats)
}
```

**Step 3: Add UI rendering**

```typescript
return (
    <ScrollView style={styles.container}>
        <Text style={styles.title}>Script Execution Test</Text>
        
        {/* Preset Scripts */}
        <View style={styles.presetContainer}>
            {PRESET_SCRIPTS.map((preset, index) => (
                <TouchableOpacity
                    key={index}
                    style={styles.presetButton}
                    onPress={() => loadPreset(index)}
                >
                    <Text style={styles.presetText}>{preset.name}</Text>
                </TouchableOpacity>
            ))}
        </View>
        
        {/* Script Editor */}
        <Text style={styles.label}>Script:</Text>
        <TextInput
            style={styles.scriptInput}
            value={script}
            onChangeText={setScript}
            multiline
            placeholder="Enter JavaScript code..."
        />
        
        {/* Parameters */}
        <Text style={styles.label}>Params (JSON):</Text>
        <TextInput
            style={styles.input}
            value={params}
            onChangeText={setParams}
            multiline
            placeholder='{"key": "value"}'
        />
        
        {/* Globals */}
        <Text style={styles.label}>Globals (JSON):</Text>
        <TextInput
            style={styles.input}
            value={globals}
            onChangeText={setGlobals}
            multiline
            placeholder='{"key": "value"}'
        />
        
        {/* Native Functions */}
        <Text style={styles.label}>Native Functions (comma-separated):</Text>
        <TextInput
            style={styles.input}
            value={nativeFunctions}
            onChangeText={setNativeFunctions}
            placeholder="func1, func2"
        />
        
        {/* Timeout */}
        <Text style={styles.label}>Timeout (ms):</Text>
        <TextInput
            style={styles.input}
            value={timeout}
            onChangeText={setTimeout}
            keyboardType="numeric"
            placeholder="5000"
        />
        
        {/* Execute Button */}
        <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={executeScript}
            disabled={loading}
        >
            <Text style={styles.buttonText}>
                {loading ? 'Executing...' : 'Execute Script'}
            </Text>
        </TouchableOpacity>
        
        {/* Clear Cache Button */}
        <TouchableOpacity style={styles.clearButton} onPress={clearCache}>
            <Text style={styles.buttonText}>Clear Cache</Text>
        </TouchableOpacity>
        
        {/* Result */}
        {result && (
            <>
                <Text style={styles.label}>Result:</Text>
                <ScrollView style={styles.resultContainer}>
                    <Text style={styles.resultText}>{result}</Text>
                </ScrollView>
            </>
        )}
        
        {/* Statistics */}
        {stats && (
            <>
                <Text style={styles.label}>Statistics:</Text>
                <View style={styles.statsContainer}>
                    <Text>Total Executions: {stats.totalExecutions}</Text>
                    <Text>Cache Hits: {stats.cacheHits}</Text>
                    <Text>Cache Misses: {stats.cacheMisses}</Text>
                    <Text>Hit Rate: {(stats.cacheHitRate * 100).toFixed(2)}%</Text>
                </View>
            </>
        )}
        
        {/* History */}
        {history.length > 0 && (
            <>
                <Text style={styles.label}>History (Last 20):</Text>
                {history.map((item, index) => (
                    <View key={index} style={styles.historyItem}>
                        <Text style={styles.historyText}>
                            {item.timestamp} - {item.duration}ms - 
                            {item.success ? ' ✓' : ' ✗'}
                        </Text>
                    </View>
                ))}
            </>
        )}
    </ScrollView>
)
```

**Step 4: Add styles**

```typescript
const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#fff'
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16
    },
    presetContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 16
    },
    presetButton: {
        backgroundColor: '#007AFF',
        padding: 8,
        borderRadius: 4,
        margin: 4
    },
    presetText: {
        color: '#fff',
        fontSize: 12
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 12,
        marginBottom: 4
    },
    scriptInput: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        padding: 8,
        minHeight: 120,
        fontFamily: 'monospace',
        fontSize: 12
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        padding: 8,
        minHeight: 60,
        fontFamily: 'monospace',
        fontSize: 12
    },
    button: {
        backgroundColor: '#34C759',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 16
    },
    buttonDisabled: {
        backgroundColor: '#ccc'
    },
    clearButton: {
        backgroundColor: '#FF3B30',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600'
    },
    resultContainer: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        padding: 8,
        maxHeight: 200,
        backgroundColor: '#f5f5f5'
    },
    resultText: {
        fontFamily: 'monospace',
        fontSize: 12
    },
    statsContainer: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        padding: 12,
        backgroundColor: '#f9f9f9'
    },
    historyItem: {
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingVertical: 8
    },
    historyText: {
        fontSize: 12,
        fontFamily: 'monospace'
    }
})
```

**Step 5: Commit**

```bash
git add dev/screens/ScriptExecutionScreen.tsx
git commit -m "feat(scriptexecution): create test UI screen

- Add 5 preset scripts (math, globals, native, fibonacci, timeout)
- Implement script editor with params/globals config
- Add native function selection
- Display execution results and errors
- Show cache statistics
- Track execution history (last 20)
- Add clear cache functionality

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 28: Add Test Screen to DevHome

**Files:**
- Modify: `3-adapter/android/pos-adapter-v1/dev/screens/DevHome.tsx`

**Step 1: Import and add ScriptExecutionScreen**

```typescript
import {ScriptExecutionScreen} from './ScriptExecutionScreen'

// In the navigation or screen list, add:
<TouchableOpacity
    style={styles.menuItem}
    onPress={() => navigation.navigate('ScriptExecution')}
>
    <Text style={styles.menuText}>Script Execution</Text>
</TouchableOpacity>

// And in the navigator:
<Stack.Screen name="ScriptExecution" component={ScriptExecutionScreen} />
```

**Step 2: Verify UI renders**

Run: `cd 3-adapter/android/pos-adapter-v1 && yarn android`
Expected: App launches, ScriptExecution screen accessible from DevHome

**Step 3: Commit**

```bash
git add dev/screens/DevHome.tsx
git commit -m "feat(scriptexecution): add test screen to DevHome

- Add ScriptExecution menu item
- Register screen in navigator
- Enable access from dev menu

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 29: First Code Review - Architecture and Implementation

**Files:**
- Review all implementation files

**Step 1: Review checklist**

- [ ] QuickJSEngine properly manages memory (no leaks)
- [ ] Timeout mechanism works correctly
- [ ] Bytecode cache implements LRU correctly
- [ ] Engine pool thread-safety (mutex usage)
- [ ] Native function registration via JSI works
- [ ] Type conversion handles all cases
- [ ] Error handling is comprehensive
- [ ] CMake configuration is correct
- [ ] TypeScript adapter validates inputs
- [ ] Test UI covers all scenarios

**Step 2: Run tests**

```bash
# Build native code
cd 3-adapter/android/pos-adapter-v1/android
./gradlew :app:assembleDebug

# Run app and test each preset script
yarn android

# Test scenarios:
# 1. Basic Math - should return 30
# 2. Global Variables - should return 40
# 3. Native Function - should call native function
# 4. Fibonacci - should return 55
# 5. Timeout Test - should timeout after 5000ms
```

**Step 3: Document review findings**

Create: `docs/reviews/2026-03-01-scriptexecution-review-1.md`

```markdown
# ScriptExecution First Code Review

## Date: 2026-03-01

## Reviewer: Claude Opus 4.6

## Architecture Review

### ✅ Strengths
- Pure C++ implementation with zero JNI overhead
- JSI HostFunction for synchronous native calls
- LRU bytecode cache with SHA256 hashing
- Engine pool for context reuse
- Comprehensive error handling

### ⚠️ Issues Found
[Document any issues found during testing]

### 🔧 Fixes Applied
[Document fixes made]

## Performance Review

- Bytecode cache hit rate: [measure]
- Average execution time: [measure]
- Memory usage: [measure]

## Next Steps
- Address any issues found
- Proceed to second review
```

**Step 4: Commit review**

```bash
git add docs/reviews/2026-03-01-scriptexecution-review-1.md
git commit -m "docs(scriptexecution): first code review

- Review architecture and implementation
- Test all preset scripts
- Document findings and fixes

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 30: Second Code Review - Performance and Edge Cases

**Files:**
- Review performance and edge cases

**Step 1: Performance testing checklist**

- [ ] Test with large scripts (>10KB)
- [ ] Test cache eviction (>100 scripts)
- [ ] Test concurrent executions
- [ ] Test memory leaks (repeated executions)
- [ ] Test timeout accuracy
- [ ] Test error recovery
- [ ] Test native function performance

**Step 2: Edge case testing**

```bash
# Test edge cases in ScriptExecutionScreen:

# 1. Empty script
# 2. Invalid JSON params
# 3. Undefined native functions
# 4. Very short timeout (100ms)
# 5. Very long timeout (60000ms)
# 6. Recursive scripts
# 7. Scripts with syntax errors
# 8. Scripts that throw exceptions
```

**Step 3: Document final review**

Create: `docs/reviews/2026-03-01-scriptexecution-review-2.md`

```markdown
# ScriptExecution Second Code Review

## Date: 2026-03-01

## Reviewer: Claude Opus 4.6

## Performance Results

### Cache Performance
- Hit rate after 100 executions: [measure]
- Cache eviction working: [yes/no]
- Memory usage stable: [yes/no]

### Execution Performance
- Small script (<1KB): [time]
- Medium script (1-10KB): [time]
- Large script (>10KB): [time]

### Edge Cases
- Empty script: [result]
- Invalid JSON: [result]
- Undefined native function: [result]
- Timeout accuracy: [result]
- Syntax errors: [result]
- Runtime exceptions: [result]

## Final Assessment

### ✅ Ready for Production
- All tests passing
- Performance meets requirements
- Error handling robust
- Memory management correct

### 📋 Recommendations
[Any recommendations for future improvements]

## Sign-off

Implementation complete and verified.
```

**Step 4: Final commit**

```bash
git add docs/reviews/2026-03-01-scriptexecution-review-2.md
git commit -m "docs(scriptexecution): second code review complete

- Performance testing completed
- Edge cases verified
- Implementation ready for production

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Implementation Complete

**Summary:**

This implementation plan provides a complete, step-by-step guide to implementing the ScriptExecution module with:

1. **Pure C++ Architecture**: Zero Kotlin, zero JNI overhead
2. **JSI Integration**: Synchronous native function calls via JSI HostFunction
3. **QuickJS Engine**: Full JavaScript execution with bytecode compilation
4. **Performance Optimizations**:
   - LRU bytecode cache (max 100 scripts)
   - Engine pool (3 instances for reuse)
   - SHA256 hashing for cache keys
   - Timeout interrupt mechanism
5. **Comprehensive Testing**: 5 preset scripts covering all scenarios
6. **Two Code Reviews**: Architecture + Performance validation

**Total Tasks**: 30
**Estimated Time**: 8-12 hours for experienced developer
**Complexity**: High (C++, JSI, QuickJS, TurboModule)

**Next Steps:**
1. Execute this plan using superpowers:executing-plans or superpowers:subagent-driven-development
2. During execution, review each step for reasonableness
3. Make rational judgments and adjustments as needed
4. Verify each commit builds and works correctly

