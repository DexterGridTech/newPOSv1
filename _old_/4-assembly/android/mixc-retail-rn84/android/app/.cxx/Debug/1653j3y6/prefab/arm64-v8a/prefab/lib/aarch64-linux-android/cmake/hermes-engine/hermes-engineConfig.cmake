if(NOT TARGET hermes-engine::hermesvm)
add_library(hermes-engine::hermesvm SHARED IMPORTED)
set_target_properties(hermes-engine::hermesvm PROPERTIES
    IMPORTED_LOCATION "/Users/dexter/.gradle/caches/8.13/transforms/04d2fcbfca8714d95627b25f132ce6a1/transformed/jetified-hermes-android-250829098.0.9-debug/prefab/modules/hermesvm/libs/android.arm64-v8a/libhermesvm.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/dexter/.gradle/caches/8.13/transforms/04d2fcbfca8714d95627b25f132ce6a1/transformed/jetified-hermes-android-250829098.0.9-debug/prefab/modules/hermesvm/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

