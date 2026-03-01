# ScriptExecution 代码修复总结

## 日期: 2026-03-01

## 修复的关键问题

### ✅ 问题 1: 异常处理改进

**文件**: `QuickJSEngine.cpp:404`

**修复前**:
```cpp
if (!engine || magic >= engine->nativeFunctions_.size()) {
    return JS_EXCEPTION;
}
```

**修复后**:
```cpp
if (!engine || magic >= engine->nativeFunctions_.size()) {
    JS_ThrowInternalError(ctx, "Invalid native function index");
    return JS_EXCEPTION;
}
```

**说明**: 在返回 `JS_EXCEPTION` 前设置实际的异常对象,避免 QuickJS 内部状态不一致。

---

### ✅ 问题 2: 类型转换中的空指针访问

**文件**: `QuickJSEngine.cpp:328`

**修复前**:
```cpp
if (value.isString()) {
    std::string str = value.getString(*nativeFunctions_[0]->runtime).utf8(*nativeFunctions_[0]->runtime);
    return JS_NewString(context_, str.c_str());
}
```

**修复后**:
```cpp
// Check if we have a runtime available for string/object conversion
if (nativeFunctions_.empty() || !nativeFunctions_[0]->runtime) {
    LOGE("No runtime available for type conversion");
    return JS_UNDEFINED;
}

if (value.isString()) {
    std::string str = value.getString(*nativeFunctions_[0]->runtime).utf8(*nativeFunctions_[0]->runtime);
    return JS_NewString(context_, str.c_str());
}
```

**说明**: 在访问 `nativeFunctions_[0]` 前检查是否为空,避免崩溃。

---

### ✅ 问题 3: ScriptExecutionModuleJSI.cpp 构造函数重复定义

**文件**: `ScriptExecutionModuleJSI.cpp`, `ScriptExecutionModule.h`, `ScriptExecutionModule.cpp`

**修复方案**:
1. 删除 `ScriptExecutionModuleJSI.cpp` 中的构造函数定义
2. 创建 `initMethodMap()` 方法用于注册 TurboModule 方法
3. 在 `ScriptExecutionModule.cpp` 构造函数中调用 `initMethodMap()`

**修复后的代码**:

`ScriptExecutionModule.h`:
```cpp
// Initialize method map (called from JSI binding)
void initMethodMap();
```

`ScriptExecutionModule.cpp`:
```cpp
ScriptExecutionModule::ScriptExecutionModule(std::shared_ptr<CallInvoker> jsInvoker)
    : TurboModule("NativeScriptsTurboModule", jsInvoker) {
    // ... engine pool initialization
    initMethodMap();
}
```

`ScriptExecutionModuleJSI.cpp`:
```cpp
void ScriptExecutionModule::initMethodMap() {
    methodMap_["executeScript"] = MethodMetadata{5, __hostFunction_ScriptExecutionModule_executeScript};
    methodMap_["getStats"] = MethodMetadata{0, __hostFunction_ScriptExecutionModule_getStats};
    methodMap_["clearCache"] = MethodMetadata{0, __hostFunction_ScriptExecutionModule_clearCache};
}
```

**说明**: 避免链接错误,正确分离构造函数和方法注册逻辑。

---

### ✅ 问题 5: 超时机制竞态条件

**文件**: `QuickJSEngine.h`, `QuickJSEngine.cpp`

**修复方案**:
1. 添加原子标志位 `std::atomic<bool> interrupted_{false}`
2. 修改 `interrupt()` 方法设置标志位
3. 修改 `interruptHandler()` 检查标志位和超时

**修复后的代码**:

`QuickJSEngine.h`:
```cpp
std::atomic<bool> interrupted_{false};
```

`QuickJSEngine.cpp`:
```cpp
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
        return 1;
    }

    return 0;
}
```

**说明**: 使用原子标志位避免竞态条件,同时支持手动中断和超时中断。

---

### ✅ 问题 6: TypeScript 适配器接口不完整

**文件**: `scriptExecution.ts`

**修复前**:
```typescript
export const scriptExecution: ScriptsExecution = {
    async executeScript<T = any>(options: ScriptExecutionOptions<T>): Promise<T> {
        // ...
    }
}

export async function getExecutionStats() { ... }
export async function clearCache() { ... }
```

**修复后**:
```typescript
export const scriptExecution: ScriptsExecution = {
    async executeScript<T = any>(options: ScriptExecutionOptions<T>): Promise<T> {
        // ...
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

**说明**: 将 `getExecutionStats` 和 `clearCache` 移入 `scriptExecution` 对象,符合 `ScriptsExecution` 接口定义。

---

### ✅ 问题 7: CMake 配置缺少必要的包含路径

**文件**: `CMakeLists.txt`

**修复前**:
```cmake
target_include_directories(scriptexecution_module PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/quickjs
)
```

**修复后**:
```cmake
target_include_directories(scriptexecution_module PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/quickjs
    ${REACT_NATIVE_DIR}/ReactCommon
    ${REACT_NATIVE_DIR}/ReactCommon/jsi
    ${REACT_NATIVE_DIR}/ReactCommon/callinvoker
    ${REACT_NATIVE_DIR}/ReactAndroid/src/main/jni/react/turbomodule
)
```

**说明**: 添加 React Native TurboModule 相关头文件路径,确保编译成功。

---

### ✅ 问题 10: 测试 UI 原生函数注册不正确

**文件**: `ScriptExecutionScreen.tsx`

**修复前**:
```typescript
nativeFunctions: nativeFunctions.split(',').map(f => f.trim()).filter(Boolean).reduce((acc, name) => {
    acc[name] = () => ({value: 42})
    return acc
}, {} as Record<string, any>)
```

**修复后**:
```typescript
// Register native functions to global scope
const nativeFuncNames = nativeFunctions.split(',').map(f => f.trim()).filter(Boolean)
const nativeFuncMap: Record<string, any> = {}

nativeFuncNames.forEach(name => {
    const func = () => ({value: 42})
    ;(global as any)[name] = func
    nativeFuncMap[name] = func
})

try {
    const execResult = await scriptExecution.executeScript({
        script,
        params: JSON.parse(params || '{}'),
        globals: JSON.parse(globals || '{}'),
        nativeFunctions: nativeFuncMap,
        timeout: parseInt(timeout, 10)
    })
    // ...
} finally {
    // Clean up global functions
    nativeFuncNames.forEach(name => {
        delete (global as any)[name]
    })
}
```

**说明**: 将原生函数注册到全局作用域,使 QuickJS 脚本能够调用,执行后清理。

---

## 修复总结

### 已修复的关键问题 (3个)
1. ✅ 问题 2: 类型转换空指针访问
2. ✅ 问题 3: 构造函数重复定义
3. ✅ 问题 6: TypeScript 接口不完整

### 已修复的优化问题 (4个)
1. ✅ 问题 1: 异常处理改进
2. ✅ 问题 5: 超时机制竞态条件
3. ✅ 问题 7: CMake 配置完善
4. ✅ 问题 10: 测试 UI 原生函数注册

### 未修复的问题 (3个)
1. ⚠️ 问题 4: JSON 字符串拼接安全性 (建议使用 JSON 库)
2. ⚠️ 问题 8: 引擎池耗尽处理 (建议添加等待机制)
3. ⚠️ 问题 9: QuickJS 编译优化 (建议添加编译标志)

## 测试建议

修复完成后,建议进行以下测试:

1. **编译测试**: 确保 C++ 代码编译通过
2. **类型检查**: 确保 TypeScript 代码无类型错误
3. **功能测试**:
   - 测试基础数学运算
   - 测试全局变量
   - 测试原生函数调用
   - 测试超时机制
   - 测试错误处理
4. **内存测试**: 使用 Valgrind 或 AddressSanitizer 检查内存泄漏
5. **并发测试**: 测试多个脚本并发执行

## 下一步

1. 编译并测试修复后的代码
2. 如果测试通过,进行第二次代码审查
3. 考虑修复剩余的优化问题
4. 添加更多测试场景

---

修复完成时间: 2026-03-01
