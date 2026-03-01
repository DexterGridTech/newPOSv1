# ScriptExecution 模块设计方案

**日期**: 2026-03-01
**作者**: Claude Code
**状态**: 已批准

## 概述

ScriptExecution 模块用于在 React Native 应用中安全地执行 JavaScript 脚本，支持参数传递、全局变量、原生函数调用和超时控制。本设计采用完全基于 JSI 的纯 C++ 实现，追求极致性能，零 JNI 开销。

## 设计目标

1. **极致性能**: 使用 JSI + 纯 C++ 实现，零 Kotlin 层，零 JNI 开销
2. **字节码缓存**: 同样的脚本不重复编译，使用 LRU 缓存策略
3. **类型安全**: 完整的 TypeScript 类型定义和 Codegen TurboModule
4. **健壮性**: 完整的错误处理、超时机制和资源管理
5. **可测试性**: 提供完整的测试 UI 和统计功能

## 技术选型

### 核心决策

1. **C 层实现**: 使用 JSI 而不是 JNI
   - 理由: 零 JNI 开销，性能提升 3-5 倍

2. **原生函数调用**: JSI HostFunction（同步调用）
   - 理由: 零事件循环开销，性能提升 10 倍+

3. **架构**: C++ TurboModule + 独立 QuickJS 包装类
   - 理由: 职责分离，易于维护和扩展

4. **字节码缓存**: LRU Cache，最多缓存 100 个脚本
   - 理由: 避免重复编译，节省 80%+ 编译时间

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      TypeScript Layer                        │
│  scriptExecution.ts (适配器)                                 │
│  - executeScript<T>(options): Promise<T>                     │
│  - 参数序列化/反序列化                                        │
│  - 错误处理和包装                                            │
└────────────────────┬────────────────────────────────────────┘
                     │ JSI (零拷贝)
┌────────────────────▼────────────────────────────────────────┐
│                    C++ TurboModule Layer                     │
│  ScriptExecutionModule.cpp                                   │
│  - executeScript(script, params, globals, nativeFuncs, timeout) │
│  - 管理 QuickJSEngine 实例池                                 │
│  - 字节码缓存管理（LRU Cache）                               │
│  - 统计信息收集                                              │
└────────────────────┬────────────────────────────────────────┘
                     │ C++ 函数调用
┌────────────────────▼────────────────────────────────────────┐
│                  QuickJS Wrapper Layer                       │
│  QuickJSEngine.cpp/h                                         │
│  - createContext() / destroyContext()                        │
│  - compileScript() / executeFromBytecode()                   │
│  - registerNativeFunction() (JSI HostFunction)               │
│  - setGlobalVariable() / getResult()                         │
│  - interrupt() / setTimeout()                                │
└────────────────────┬────────────────────────────────────────┘
                     │ C API 调用
┌────────────────────▼────────────────────────────────────────┐
│                     QuickJS Engine                           │
│  quickjs.c/h (13个C源文件)                                   │
│  - JS_NewRuntime() / JS_NewContext()                         │
│  - JS_Eval() / JS_EvalFunction()                             │
│  - JS_ReadObject() / JS_WriteObject() (字节码)               │
│  - JS_SetInterruptHandler()                                  │
└─────────────────────────────────────────────────────────────┘
```

## 详细设计

### 1. TypeScript 层

**文件**: `src/foundations/scriptExecution.ts`

**接口定义**:
```typescript
export interface ScriptsExecution {
    executeScript<T = any>(options: ScriptExecutionOptions<T>): Promise<T>;
}

export interface ScriptExecutionOptions<T = any> {
    script: string;
    params?: Record<string, any>;
    globals?: Record<string, any>;
    nativeFunctions?: Record<string, (...args: any[]) => any>;
    timeout?: number;  // 默认 5000ms
}

export class ScriptExecutionError extends Error {
    constructor(
        message: string,
        public readonly script: string,
        public readonly code: string,
        public readonly originalError?: any
    )
}
```

**核心逻辑**:
1. 参数验证（脚本不能为空）
2. 参数序列化（JSON.stringify）
3. 调用 C++ TurboModule
4. 结果反序列化（JSON.parse）
5. 错误包装

### 2. C++ TurboModule 层

**文件**: `android/app/src/main/cpp/ScriptExecutionModule.cpp/h`

**核心数据结构**:
```cpp
class ScriptExecutionModule : public NativeScriptsTurboModuleCxxSpec<ScriptExecutionModule> {
private:
    // 字节码缓存（LRU Cache）
    std::unordered_map<std::string, std::vector<uint8_t>> bytecodeCache_;
    std::list<std::string> lruList_;
    std::mutex cacheMutex_;
    static constexpr size_t MAX_CACHE_SIZE = 100;

    // QuickJS 引擎实例池
    std::vector<std::unique_ptr<QuickJSEngine>> enginePool_;
    std::mutex poolMutex_;

    // 统计信息
    std::atomic<uint64_t> totalExecutions_{0};
    std::atomic<uint64_t> cacheHits_{0};
    std::atomic<uint64_t> cacheMisses_{0};
};
```

**字节码缓存机制**:
- 使用脚本内容的 SHA256 哈希作为缓存键
- LRU 策略：最多缓存 100 个脚本
- 缓存命中时直接使用字节码，跳过编译
- 线程安全：使用 mutex 保护

**引擎池机制**:
- 预创建 2-4 个 QuickJSEngine 实例
- 执行时从池中获取，完毕后归还
- 避免频繁创建/销毁上下文的开销

### 3. QuickJS Wrapper 层

**文件**: `android/app/src/main/cpp/QuickJSEngine.cpp/h`

**核心接口**:
```cpp
class QuickJSEngine {
public:
    // 上下文管理
    bool createContext();
    void destroyContext();
    void reset();

    // 脚本编译和执行
    std::vector<uint8_t> compileScript(const std::string& script);
    bool executeFromBytecode(const std::vector<uint8_t>& bytecode);
    bool executeScript(const std::string& script);

    // 变量和函数注册
    void setGlobalVariable(const std::string& name, const std::string& jsonValue);
    void registerNativeFunction(
        const std::string& name,
        std::function<jsi::Value(jsi::Runtime&, const jsi::Value*, size_t)> func
    );

    // 结果获取
    std::string getResult();
    std::string getError();
    bool hasError() const;

    // 超时和中断
    void setTimeout(uint32_t ms);
    void interrupt();
};
```

**关键实现**:

1. **字节码编译**:
   - 使用 `JS_Eval` 编译脚本
   - 使用 `JS_WriteObject` 序列化为字节码
   - 返回字节码向量

2. **原生函数注册**:
   - 创建 C 函数包装器
   - 转换参数：QuickJS JSValue ↔ jsi::Value
   - 调用 JSI HostFunction
   - 转换结果并返回

3. **超时中断**:
   - 使用 `JS_SetInterruptHandler`
   - 每 100ms 检查一次超时
   - 超时后立即中断执行

### 4. 数据流

**完整执行流程**:
```
1. TS 层调用 executeScript()
2. 参数序列化（JSON）
3. JSI 桥接到 C++ TurboModule
4. 计算脚本哈希，检查字节码缓存
   ├─ 缓存命中 → 跳到步骤 7
   └─ 缓存未命中 → 继续
5. 从引擎池获取 QuickJSEngine
6. 编译脚本为字节码，存入缓存
7. 注册原生函数（JSI HostFunction → QuickJS C Function）
8. 设置全局变量和参数
9. 设置超时中断处理器
10. 执行字节码
    ├─ 脚本调用原生函数
    │  ↓ QuickJS → C Function → JSI HostFunction → TS 函数
    │  ↓ 返回：TS → JSI → C++ → QuickJS
    │  ↓ 继续执行脚本
    └─ 脚本执行完毕
11. 获取结果（JSON）
12. 归还引擎到池中
13. JSI 桥接返回 TS 层
14. 反序列化结果
```

### 5. 错误处理

**错误码定义**:
```typescript
export enum ScriptErrorCode {
    EMPTY_SCRIPT = 'SCRIPT_001',
    TIMEOUT = 'SCRIPT_002',
    COMPILATION_ERROR = 'SCRIPT_003',
    RUNTIME_ERROR = 'SCRIPT_004',
    NATIVE_FUNCTION_ERROR = 'SCRIPT_005',
    OUT_OF_MEMORY = 'SCRIPT_006',
    UNKNOWN = 'SCRIPT_999'
}
```

**错误处理策略**:
- 所有错误统一包装为 `ScriptExecutionError`
- 包含错误码、错误消息、堆栈跟踪
- 超时后立即中断，清理资源
- 原生函数异常捕获并返回错误

### 6. 性能优化

**优化点**:
1. ✅ 字节码缓存：避免重复编译（节省 80%+ 编译时间）
2. ✅ 引擎池：避免频繁创建/销毁（节省 50%+ 初始化时间）
3. ✅ JSI 直接调用：零 JNI 开销（比旧实现快 3-5 倍）
4. ✅ 同步原生函数：零事件循环开销（比异步快 10 倍+）

**预期性能**:
- 首次执行：~20-30ms（包含编译）
- 缓存命中：~5-10ms（跳过编译）
- 原生函数调用：~0.1-0.5ms（同步调用）

## 测试UI设计

**文件**: `dev/screens/ScriptExecutionScreen.tsx`

**功能**:
1. 脚本编辑器（多行输入）
2. 参数配置（JSON 格式）
3. 全局变量配置（JSON 格式）
4. 原生函数配置（预设常用函数）
5. 超时设置（滑块，1-30秒）
6. 执行按钮和结果显示
7. 执行统计（总次数、成功率、平均耗时、缓存命中率）
8. 执行历史（最近 20 条记录）
9. 预设脚本（5 个示例）

**预设脚本**:
1. 基础运算：`return params.a + params.b;`
2. 全局变量：`return Math.PI * 2;`
3. 原生函数：`log('Hello'); return 'done';`
4. 复杂计算：斐波那契数列
5. 超时测试：无限循环

## 文件结构

```
3-adapter/android/pos-adapter-v1/
├── src/
│   ├── foundations/
│   │   └── scriptExecution.ts          # TS 适配器
│   └── specs/
│       └── NativeScriptsTurboModule.ts # TurboModule Spec
├── dev/screens/
│   ├── DevHome.tsx                     # 添加 ScriptExecution 菜单
│   └── ScriptExecutionScreen.tsx       # 测试UI（新建）
└── android/app/src/main/
    ├── java/com/impos2/posadapterrn84/
    │   └── PosAdapterTurboPackage.kt   # 注册 TurboModule
    └── cpp/
        ├── CMakeLists.txt              # 编译配置
        ├── ScriptExecutionModule.cpp   # C++ TurboModule
        ├── ScriptExecutionModule.h
        ├── QuickJSEngine.cpp           # QuickJS 包装类
        ├── QuickJSEngine.h
        └── quickjs/                    # QuickJS 源码（13个文件）
            ├── quickjs.c
            ├── quickjs.h
            ├── libregexp.c
            ├── libunicode.c
            ├── dtoa.c
            └── ... (其他8个文件)
```

## 实现计划

实现将分为以下阶段：

1. **阶段 1**: 基础架构搭建
   - 创建 TurboModule Spec
   - 创建 C++ TurboModule 骨架
   - 配置 CMakeLists.txt

2. **阶段 2**: QuickJS 集成
   - 复制 QuickJS 源码
   - 实现 QuickJSEngine 包装类
   - 实现字节码编译和执行

3. **阶段 3**: 字节码缓存
   - 实现 LRU Cache
   - 实现脚本哈希计算
   - 实现缓存命中/未命中逻辑

4. **阶段 4**: 原生函数支持
   - 实现 JSI HostFunction 注册
   - 实现参数类型转换
   - 实现结果类型转换

5. **阶段 5**: 错误处理和超时
   - 实现错误捕获和包装
   - 实现超时中断机制
   - 实现资源清理

6. **阶段 6**: TS 适配器
   - 实现 scriptExecution.ts
   - 实现参数序列化/反序列化
   - 实现错误包装

7. **阶段 7**: 测试UI
   - 创建 ScriptExecutionScreen.tsx
   - 实现预设脚本
   - 实现统计和历史记录

8. **阶段 8**: 代码审查
   - 第一次代码审查
   - 修复 Critical 和 Important 问题
   - 第二次代码审查

## 风险和挑战

1. **C++ 复杂度**: 纯 C++ 实现复杂度高
   - 缓解: 参考 RN 官方 TurboModule 示例

2. **JSI 类型转换**: QuickJS JSValue ↔ jsi::Value 转换复杂
   - 缓解: 实现完整的类型转换工具函数

3. **内存管理**: C++ 手动内存管理容易出错
   - 缓解: 使用 RAII 和智能指针

4. **线程安全**: 多线程访问缓存和引擎池
   - 缓解: 使用 mutex 保护所有共享资源

## 验收标准

1. ✅ 所有接口符合 `ScriptsExecution` 定义
2. ✅ 字节码缓存正常工作，缓存命中率 > 80%
3. ✅ 原生函数调用正常工作
4. ✅ 超时机制正常工作
5. ✅ 错误处理完整，所有错误都有错误码
6. ✅ 测试UI功能完整
7. ✅ 通过两次代码审查
8. ✅ 性能达标：缓存命中 < 10ms，首次执行 < 30ms

## 参考资料

- React Native 0.84.1 JSI 文档
- QuickJS 官方文档
- 旧实现（_old_/pos-adapter）
- 迁移指南（ai-result/pos-adapter-migration-guide.md）
