cmake_minimum_required(VERSION 3.22.1)

project(pos-adapter-v1)

# Set C++ standard
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Determine if this is being built as a subproject
if(NOT DEFINED IMPOS2_ADAPTER_AS_SUBPROJECT)
    if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
        set(IMPOS2_ADAPTER_AS_SUBPROJECT OFF)
    else()
        set(IMPOS2_ADAPTER_AS_SUBPROJECT ON)
    endif()
endif()

# Find React Native (only if not already found)
if(NOT TARGET ReactAndroid::jsi)
    find_package(ReactAndroid REQUIRED CONFIG)
endif()
if(NOT TARGET fbjni::fbjni)
    find_package(fbjni REQUIRED CONFIG)
endif()

# ScriptExecution module temporarily disabled for testing
# Find OpenSSL (optional, will use alternative if not found)
# find_library(CRYPTO_LIB crypto)

# Add QuickJS source files
# file(GLOB QUICKJS_SRC
#     "${CMAKE_CURRENT_SOURCE_DIR}/quickjs/*.c"
# )

# Add ScriptExecution module as a reusable library
# add_library(scriptexecution_module STATIC
#     ${CMAKE_CURRENT_SOURCE_DIR}/QuickJSEngine.cpp
#     ${CMAKE_CURRENT_SOURCE_DIR}/ScriptExecutionModule.cpp
#     ${CMAKE_CURRENT_SOURCE_DIR}/ScriptExecutionModuleJSI.cpp
#     ${QUICKJS_SRC}
# )

# Set an alias for easier reference
# add_library(impos2::scriptexecution ALIAS scriptexecution_module)

# Public include directories (available to consumers)
# target_include_directories(scriptexecution_module PUBLIC
#     $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}>
#     $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/quickjs>
#     $<INSTALL_INTERFACE:include>
# )

# target_link_libraries(scriptexecution_module PUBLIC
#     ReactAndroid::jsi
#     ReactAndroid::reactnative
#     fbjni::fbjni
#     log
# )

# Link OpenSSL if available
# if(CRYPTO_LIB)
#     target_link_libraries(scriptexecution_module PRIVATE ${CRYPTO_LIB})
# endif()

# Only create the main library if this is the main project
if(NOT IMPOS2_ADAPTER_AS_SUBPROJECT)
    # Create main library
    add_library(${CMAKE_PROJECT_NAME} SHARED
        cpp-adapter.cpp
    )

    target_link_libraries(${CMAKE_PROJECT_NAME}
        # scriptexecution_module  # temporarily disabled
        ReactAndroid::jsi
        ReactAndroid::reactnative
        fbjni::fbjni
        android
        log
    )
endif()

# Export targets for use by other projects
# if(IMPOS2_ADAPTER_AS_SUBPROJECT)
#     # Make scriptexecution_module available to parent project
#     set(SCRIPTEXECUTION_MODULE_TARGET scriptexecution_module PARENT_SCOPE)
#     set(SCRIPTEXECUTION_MODULE_INCLUDE_DIRS
#         ${CMAKE_CURRENT_SOURCE_DIR}
#         ${CMAKE_CURRENT_SOURCE_DIR}/quickjs
#         PARENT_SCOPE
#     )
# endif()
