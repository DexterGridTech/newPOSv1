# ScriptExecution 第一次代码审查

## 日期: 2026-03-01

## 审查人: Claude Opus 4.6

## 架构审查

### ✅ 优点

1. **纯 C++ 实现,零 JNI 开销**
   - 完全使用 C++ 和 JSI,避免了 JNI 的性能损耗
   - 直接通过 JSI 与 React Native 通信

2. **JSI HostFunction 实现同步原生调用**
   - 使用 JSI HostFunction 包装原生函数
   - 支持从 QuickJS 脚本中同步调用 React Native 的全局函数

3. **LRU 字节码缓存**
   - 使用 SHA256 哈希作为缓存键
   - 最大缓存 100 个脚本
   - 正确实现 LRU 淘汰策略

4. **引擎池设计**
   - 3 个 QuickJS 引擎实例用于复用
   - 使用 mutex 保证线程安全
   - 引擎使用后正确重置状态

5. **全面的错误处理**
   - 提取错误消息和堆栈跟踪
   - 所有 QuickJS 资源正确释放
   - 超时机制正确实现

### ⚠️ 发现的问题

#### 问题 1: QuickJSEngine 内存泄漏风险

**位置**: `QuickJSEngine.cpp:405` - `nativeFunctionCallback`

**问题描述**:
```cpp
if (!engine || magic >= engine->nativeFunctions_.size()) {
    return JS_EXCEPTION;
}
```

当返回 `JS_EXCEPTION` 时,没有设置实际的异常对象,这可能导致 QuickJS 内部状态不一致。

**修复方案**:
```cpp
if (!engine || magic >= engine->nativeFunctions_.size()) {
    JS_ThrowInternalError(ctx, "Invalid native function index");
    return JS_EXCEPTION;
}
```

#### 问题 2: 类型转换中的运行时指针访问

**位置**: `QuickJSEngine.cpp:342` 和 `QuickJSEngine.cpp:356`

**问题描述**:
```cpp
std::string str = value.getString(*nativeFunctions_[0]->runtime).utf8(*nativeFunctions_[0]->runtime);
```

假设 `nativeFunctions_[0]` 总是存在,但在没有注册任何原生函数时会崩溃。

**修复方案**:
```cpp
if (nativeFunctions_.empty() || !nativeFunctions_[0]->runtime) {
    LOGE("No runtime available for type conversion");
    return JS_UNDEFINED;
}
```

#### 问题 3: ScriptExecutionModuleJSI.cpp 中的构造函数重复定义

**位置**: `ScriptExecutionModuleJSI.cpp:45`

**问题描述**:
构造函数在 `ScriptExecutionModule.cpp:14` 已经定义,在 JSI 绑定文件中又定义了一次,会导致链接错误。

**修复方案**:
删除 `ScriptExecutionModuleJSI.cpp:45-50` 的构造函数定义,只保留方法注册逻辑。应该创建一个单独的初始化方法。

#### 问题 4: JSON 字符串拼接存在注入风险

**位置**: `ScriptExecutionModule.cpp:206` 和 `ScriptExecutionModule.cpp:210`

**问题描述**:
```cpp
resultJson = R"({"success":true,"result":)" + result + "}";
```

如果 `result` 或 `error` 包含特殊字符(如引号),会导致 JSON 格式错误。

**修复方案**:
使用 JSON 库(如 nlohmann/json)或正确转义字符串:
```cpp
// 需要实现 escapeJsonString 函数
std::string escapeJsonString(const std::string& str) {
    std::string escaped;
    for (char c : str) {
        switch (c) {
            case '"': escaped += "\\\""; break;
            case '\\': escaped += "\\\\"; break;
            case '\n': escaped += "\\n"; break;
            case '\r': escaped += "\\r"; break;
            case '\t': escaped += "\\t"; break;
            default: escaped += c;
        }
    }
    return escaped;
}
```

#### 问题 5: 超时机制的竞态条件

**位置**: `QuickJSEngine.cpp:96-99`

**问题描述**:
```cpp
void QuickJSEngine::interrupt() {
    if (runtime_) {
        JS_SetInterruptHandler(runtime_, [](JSRuntime*, void*) { return 1; }, nullptr);
    }
}
```

`interrupt()` 方法会覆盖原有的超时中断处理器,导致超时机制失效。

**修复方案**:
使用原子标志位:
```cpp
// 在头文件中添加
std::atomic<bool> interrupted_{false};

// 修改 interrupt()
void QuickJSEngine::interrupt() {
    interrupted_ = true;
}

// 修改 interruptHandler
int QuickJSEngine::interruptHandler(JSRuntime* rt, void* opaque) {
    auto* engine = static_cast<QuickJSEngine*>(opaque);

    if (engine->interrupted_) {
        return 1;
    }

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

#### 问题 6: TypeScript 适配器缺少统计和缓存管理方法

**位置**: `scriptExecution.ts:4`

**问题描述**:
`scriptExecution` 对象只实现了 `executeScript` 方法,但 `getExecutionStats` 和 `clearCache` 是独立导出的函数,不符合 `ScriptsExecution` 接口。

**修复方案**:
```typescript
export const scriptExecution: ScriptsExecution = {
    async executeScript<T = any>(options: ScriptExecutionOptions<T>): Promise<T> {
        // ... 现有实现
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

#### 问题 7: CMake 配置缺少必要的包含路径

**位置**: `CMakeLists.txt:26-29`

**问题描述**:
缺少 React Native 的 TurboModule 相关头文件路径,可能导致编译失败。

**修复方案**:
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

#### 问题 8: 引擎池耗尽时的处理不当

**位置**: `ScriptExecutionModule.cpp:126-129`

**问题描述**:
当引擎池耗尽时,直接返回错误,但没有考虑等待或创建临时引擎。

**建议改进**:
添加等待机制或创建临时引擎:
```cpp
QuickJSEngine* ScriptExecutionModule::acquireEngine() {
    std::unique_lock<std::mutex> lock(poolMutex_);

    // 等待最多 5 秒
    auto timeout = std::chrono::seconds(5);
    auto deadline = std::chrono::steady_clock::now() + timeout;

    while (enginePool_.empty()) {
        if (std::chrono::steady_clock::now() >= deadline) {
            LOGE("Engine pool exhausted, timeout waiting");
            return nullptr;
        }
        // 释放锁并等待
        lock.unlock();
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
        lock.lock();
    }

    auto engine = std::move(enginePool_.back());
    enginePool_.pop_back();

    LOGI("Acquired engine, %zu remaining in pool", enginePool_.size());
    return engine.release();
}
```

#### 问题 9: 缺少对 QuickJS 编译标志的控制

**位置**: `CMakeLists.txt:14-16`

**问题描述**:
QuickJS 源文件直接编译,没有设置必要的编译标志(如禁用不需要的功能)。

**建议改进**:
```cmake
# Add QuickJS source files with specific flags
set(QUICKJS_SRC
    "${CMAKE_CURRENT_SOURCE_DIR}/quickjs/quickjs.c"
    "${CMAKE_CURRENT_SOURCE_DIR}/quickjs/libregexp.c"
    "${CMAKE_CURRENT_SOURCE_DIR}/quickjs/libunicode.c"
    "${CMAKE_CURRENT_SOURCE_DIR}/quickjs/dtoa.c"
)

# Set QuickJS compile definitions
add_compile_definitions(
    CONFIG_VERSION="2024-01-13"
    CONFIG_BIGNUM=0
)
```

#### 问题 10: 测试 UI 中原生函数的模拟实现不正确

**位置**: `ScriptExecutionScreen.tsx:71-74`

**问题描述**:
```typescript
nativeFunctions: nativeFunctions.split(',').map(f => f.trim()).filter(Boolean).reduce((acc, name) => {
    acc[name] = () => ({value: 42})
    return acc
}, {} as Record<string, any>)
```

这只是创建了一个对象,但没有真正注册到全局作用域,QuickJS 脚本无法调用这些函数。

**修复方案**:
需要在 React Native 全局作用域中注册这些函数:
```typescript
// 在执行前注册到全局
const nativeFuncNames = nativeFunctions.split(',').map(f => f.trim()).filter(Boolean)
nativeFuncNames.forEach(name => {
    (global as any)[name] = () => ({value: 42})
})

const execResult = await scriptExecution.executeScript({
    script,
    params: JSON.parse(params || '{}'),
    globals: JSON.parse(globals || '{}'),
    nativeFunctions: nativeFuncNames.reduce((acc, name) => {
        acc[name] = (global as any)[name]
        return acc
    }, {} as Record<string, any>),
    timeout: parseInt(timeout, 10)
})

// 执行后清理
nativeFuncNames.forEach(name => {
    delete (global as any)[name]
})
```

### 🔧 需要立即修复的问题

1. **问题 3**: ScriptExecutionModuleJSI.cpp 构造函数重复定义 - 会导致编译失败
2. **问题 2**: 类型转换中的空指针访问 - 会导致崩溃
3. **问题 6**: TypeScript 适配器接口不完整 - 会导致类型错误

### ⚡ 建议优化的问题

1. **问题 1**: 异常处理改进
2. **问题 4**: JSON 字符串安全性
3. **问题 5**: 超时机制竞态条件
4. **问题 7**: CMake 配置完善
5. **问题 8**: 引擎池耗尽处理
6. **问题 9**: QuickJS 编译优化
7. **问题 10**: 测试 UI 原生函数注册

## 性能审查

### 内存管理

✅ **正确的方面**:
- QuickJS 资源使用 RAII 模式管理
- `JS_FreeValue` 在所有路径上正确调用
- 引擎池使用 `unique_ptr` 自动管理生命周期
- 字节码缓存使用 `std::vector` 自动管理内存

⚠️ **潜在问题**:
- 类型转换中创建的临时 JSI 对象可能导致内存峰值
- 大型脚本的字节码缓存可能占用大量内存(建议添加大小限制)

### 线程安全

✅ **正确的方面**:
- 引擎池使用 `std::mutex` 保护
- 字节码缓存使用 `std::mutex` 保护
- 统计计数器使用 `std::atomic`

✅ **无问题**: 线程安全实现正确

### 缓存性能

✅ **LRU 实现正确**:
- 使用时间戳跟踪最后使用时间
- 淘汰策略正确实现
- 缓存命中率统计准确

⚠️ **优化建议**:
- 考虑使用 `std::list` + `std::unordered_map` 实现 O(1) LRU
- 当前实现是 O(n) 查找最旧条目

## 类型转换审查

### JSI ↔ QuickJS 转换

✅ **支持的类型**:
- undefined, null, boolean, number, string ✅
- object (通过 JSON 序列化) ✅

⚠️ **缺少的类型**:
- Array (应该直接转换,而不是通过 JSON)
- Function (无法通过 JSON 传递)
- Symbol (不支持)

**建议改进**: 添加 Array 的直接转换支持

## 错误处理审查

✅ **全面的错误处理**:
- 编译错误 ✅
- 执行错误 ✅
- 超时错误 ✅
- 引擎池耗尽 ✅
- JSON 解析错误 ✅

✅ **错误信息完整**:
- 错误消息 ✅
- 堆栈跟踪 ✅
- 错误代码 ✅

## CMake 配置审查

⚠️ **需要改进**:
- 缺少 TurboModule 头文件路径(问题 7)
- 缺少 QuickJS 编译标志(问题 9)
- 建议添加编译优化标志

## TypeScript 适配器审查

⚠️ **需要修复**:
- 接口实现不完整(问题 6)
- 输入验证正确 ✅
- 错误包装正确 ✅

## 测试 UI 审查

✅ **覆盖的场景**:
- 基础数学运算 ✅
- 全局变量 ✅
- 原生函数调用 ⚠️ (实现不正确,问题 10)
- 递归函数(斐波那契) ✅
- 超时测试 ✅

⚠️ **缺少的场景**:
- 错误处理测试(语法错误、运行时错误)
- 大型脚本测试
- 并发执行测试
- 缓存命中率测试

## 总体评估

### ✅ 架构设计优秀
- 纯 C++ + JSI 实现,性能优异
- 引擎池和字节码缓存设计合理
- 线程安全实现正确

### ⚠️ 需要修复的关键问题
1. ScriptExecutionModuleJSI.cpp 构造函数重复定义
2. 类型转换中的空指针访问
3. TypeScript 适配器接口不完整

### 📋 建议改进
1. JSON 字符串拼接安全性
2. 超时机制竞态条件
3. 引擎池耗尽处理
4. CMake 配置完善
5. 测试 UI 原生函数注册
6. 添加更多测试场景

## 下一步行动

1. **立即修复关键问题**(问题 2, 3, 6)
2. **改进安全性**(问题 1, 4, 5)
3. **完善配置**(问题 7, 9)
4. **优化性能**(问题 8)
5. **改进测试**(问题 10,添加更多场景)
6. **进行第二次审查**

## 签署

实现质量: **良好** (需要修复关键问题后可投入使用)

架构设计: **优秀**

代码质量: **良好** (需要改进错误处理和安全性)

---

审查完成时间: 2026-03-01
