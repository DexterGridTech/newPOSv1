cmake_minimum_required(VERSION 3.22.1)

project(pos-adapter-v1)

# Set C++ standard
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find React Native
find_package(ReactAndroid REQUIRED CONFIG)
find_package(fbjni REQUIRED CONFIG)

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
)

target_link_libraries(scriptexecution_module
    ReactAndroid::jsi
    ReactAndroid::reactnative
    fbjni::fbjni
    crypto  # OpenSSL for SHA256
    log
)

# Create main library
add_library(${CMAKE_PROJECT_NAME} SHARED
    cpp-adapter.cpp
)

target_link_libraries(${CMAKE_PROJECT_NAME}
    scriptexecution_module
    ReactAndroid::jsi
    ReactAndroid::reactnative
    fbjni::fbjni
    android
    log
)
