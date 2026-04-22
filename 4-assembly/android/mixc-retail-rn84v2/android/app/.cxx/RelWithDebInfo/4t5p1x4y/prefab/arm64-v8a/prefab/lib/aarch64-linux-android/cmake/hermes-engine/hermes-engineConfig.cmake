if(NOT TARGET hermes-engine::hermesvm)
add_library(hermes-engine::hermesvm SHARED IMPORTED)
set_target_properties(hermes-engine::hermesvm PROPERTIES
    IMPORTED_LOCATION "/Users/dexter/.gradle/caches/9.0.0/transforms/9f4d4a9e56b63e98a49025f798ed88f6/transformed/hermes-android-250829098.0.9-release/prefab/modules/hermesvm/libs/android.arm64-v8a/libhermesvm.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/dexter/.gradle/caches/9.0.0/transforms/9f4d4a9e56b63e98a49025f798ed88f6/transformed/hermes-android-250829098.0.9-release/prefab/modules/hermesvm/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

