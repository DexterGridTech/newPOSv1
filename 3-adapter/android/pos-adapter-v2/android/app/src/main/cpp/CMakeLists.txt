cmake_minimum_required(VERSION 3.22.1)

project(pos-adapter-v2)

# Set C++ standard
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Determine if this is being built as a subproject
if(NOT DEFINED IMPOS2_ADAPTER_V2_AS_SUBPROJECT)
    if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
        set(IMPOS2_ADAPTER_V2_AS_SUBPROJECT OFF)
    else()
        set(IMPOS2_ADAPTER_V2_AS_SUBPROJECT ON)
    endif()
endif()

# Find React Native (only if not already found)
if(NOT TARGET ReactAndroid::jsi)
    find_package(ReactAndroid REQUIRED CONFIG)
endif()
if(NOT TARGET fbjni::fbjni)
    find_package(fbjni REQUIRED CONFIG)
endif()

# Only create the main library if this is the main project
if(NOT IMPOS2_ADAPTER_V2_AS_SUBPROJECT)
    # Create main library
    add_library(${CMAKE_PROJECT_NAME} SHARED
        cpp-adapter.cpp
    )

    target_link_libraries(${CMAKE_PROJECT_NAME}
        ReactAndroid::jsi
        ReactAndroid::reactnative
        fbjni::fbjni
        android
        log
    )
endif()
