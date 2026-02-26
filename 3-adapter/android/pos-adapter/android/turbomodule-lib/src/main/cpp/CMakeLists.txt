cmake_minimum_required(VERSION 3.22.1)
project(quickjs_bridge C)

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
    # quickjs-ng 版本标识（从 quickjs-ng 的 VERSION 文件获取实际版本）
    -DCONFIG_VERSION="2024-01-13"
    # 关闭 bignum 扩展（减小体积，如需启用请同时添加 quickjs/libbf.c）
    -UCONFIG_BIGNUM
)

target_link_libraries(quickjs_bridge android log)
