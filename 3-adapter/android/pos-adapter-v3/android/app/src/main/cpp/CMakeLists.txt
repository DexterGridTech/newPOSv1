cmake_minimum_required(VERSION 3.13)

# Define the library name - MUST be appmodules for React Native
project(appmodules)

# This file includes all the necessary to let you build your React Native application
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# Add our custom quickjs_bridge library
add_library(quickjs_bridge SHARED
    quickjs/quickjs.c
    quickjs/libregexp.c
    quickjs/libunicode.c
    quickjs/dtoa.c
    quickjs_bridge.c
)

target_compile_options(quickjs_bridge PRIVATE
    -std=c11
    -O2
    -fvisibility=hidden
    -fno-exceptions
    -D_GNU_SOURCE
    -DCONFIG_VERSION="2024-01-13"
    -UCONFIG_BIGNUM
)

target_link_libraries(quickjs_bridge android log)
