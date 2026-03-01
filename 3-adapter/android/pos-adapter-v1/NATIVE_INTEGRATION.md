# Native Integration Guide

本文档说明如何在整合包中集成 `@impos2/adapter-android-rn84` 的原生代码。

## 方案 1: 使用 add_subdirectory (推荐)

在整合包的 `android/app/src/main/cpp/CMakeLists.txt` 中:

```cmake
cmake_minimum_required(VERSION 3.22.1)

project(your-integration-app)

# Set C++ standard
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find React Native
find_package(ReactAndroid REQUIRED CONFIG)
find_package(fbjni REQUIRED CONFIG)

# Add adapter as subdirectory
set(ADAPTER_PATH "${CMAKE_CURRENT_SOURCE_DIR}/../../node_modules/@impos2/adapter-android-rn84/android/app/src/main/cpp")
add_subdirectory(${ADAPTER_PATH} adapter-android-rn84)

# Create your main library
add_library(${CMAKE_PROJECT_NAME} SHARED
    your-cpp-adapter.cpp
)

# Link with scriptexecution_module
target_link_libraries(${CMAKE_PROJECT_NAME}
    impos2::scriptexecution  # 使用 alias
    ReactAndroid::jsi
    ReactAndroid::reactnative
    fbjni::fbjni
    android
    log
)
```

## 方案 2: 直接引用 CMakeLists.txt

在整合包的 `android/app/build.gradle` 中:

```gradle
android {
    externalNativeBuild {
        cmake {
            // 方式 A: 直接使用适配层的 CMakeLists.txt
            path "../../node_modules/@impos2/adapter-android-rn84/android/app/src/main/cpp/CMakeLists.txt"
            version "3.22.1"
        }
    }
}
```

或者在你自己的 CMakeLists.txt 中:

```cmake
# 方式 B: 包含适配层的 CMakeLists.txt
include(${CMAKE_CURRENT_SOURCE_DIR}/../../node_modules/@impos2/adapter-android-rn84/android/app/src/main/cpp/CMakeLists.txt)
```

## 关键特性

### 1. 自动检测构建模式

CMakeLists.txt 会自动检测是作为主项目还是子项目:
- **主项目模式**: 创建完整的 `pos-adapter-v1` 共享库
- **子项目模式**: 只导出 `scriptexecution_module` 静态库

### 2. 目标别名

提供了 `impos2::scriptexecution` 别名,方便引用:

```cmake
target_link_libraries(your_target
    impos2::scriptexecution  # 推荐使用别名
    # 或者
    scriptexecution_module   # 直接使用目标名
)
```

### 3. 依赖管理

- 自动检测 React Native 和 fbjni 是否已找到
- 避免重复查找依赖
- 正确处理 PUBLIC/PRIVATE 链接

### 4. 头文件路径

使用 Generator Expressions 确保头文件路径在构建和安装时都正确:

```cmake
target_include_directories(scriptexecution_module PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}>
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/quickjs>
    $<INSTALL_INTERFACE:include>
)
```

## 验证集成

编译整合包后,检查是否成功:

```bash
cd your-integration-app/android
./gradlew :app:assembleDebug

# 检查生成的库
find app/build -name "*.so" | grep scriptexecution
```

## 故障排查

### 问题 1: 找不到 ReactAndroid::jsi

**原因**: React Native 的 CMake 配置未正确加载

**解决**: 确保整合包的 `build.gradle` 中有:

```gradle
react {
    autolinkLibrariesWithApp()
}
```

### 问题 2: 重复定义符号

**原因**: 适配层和整合包都定义了相同的符号

**解决**: 使用 `add_subdirectory` 方式,并确保只链接一次

### 问题 3: 头文件找不到

**原因**: include 路径不正确

**解决**: 使用 `impos2::scriptexecution` 别名,它会自动包含正确的头文件路径

## 示例项目结构

```
your-integration-app/
├── android/
│   └── app/
│       ├── build.gradle
│       └── src/main/cpp/
│           ├── CMakeLists.txt  (引用适配层)
│           └── your-adapter.cpp
├── node_modules/
│   └── @impos2/
│       └── adapter-android-rn84/
│           └── android/app/src/main/cpp/
│               ├── CMakeLists.txt  (适配层的 CMake)
│               ├── QuickJSEngine.cpp
│               └── ScriptExecutionModule.cpp
└── package.json
```

## 最佳实践

1. **使用方案 1 (add_subdirectory)**: 更灵活,可以控制链接方式
2. **使用别名**: `impos2::scriptexecution` 比直接使用 `scriptexecution_module` 更清晰
3. **检查依赖**: 确保 React Native 版本一致
4. **清理构建**: 修改 CMake 配置后,清理构建缓存:
   ```bash
   cd android
   ./gradlew clean
   rm -rf .cxx
   ```

## 技术细节

### 构建模式检测

```cmake
if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
    # 主项目模式
else()
    # 子项目模式
endif()
```

### 导出变量

在子项目模式下,导出以下变量到父作用域:
- `SCRIPTEXECUTION_MODULE_TARGET`: 目标名称
- `SCRIPTEXECUTION_MODULE_INCLUDE_DIRS`: 头文件目录

### 链接类型

- `PUBLIC`: ReactAndroid, fbjni (消费者也需要)
- `PRIVATE`: OpenSSL crypto (仅内部使用)

## 支持

如有问题,请检查:
1. CMake 版本 >= 3.22.1
2. NDK 版本兼容
3. React Native 版本 = 0.84.1
4. C++ 标准 = C++20
