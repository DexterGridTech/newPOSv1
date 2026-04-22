if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "/Users/dexter/.gradle/caches/8.10.2/transforms/4fea562f4f21af394f37ff344d75971c/transformed/hermes-android-0.77.1-debug/prefab/modules/libhermes/libs/android.armeabi-v7a/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/dexter/.gradle/caches/8.10.2/transforms/4fea562f4f21af394f37ff344d75971c/transformed/hermes-android-0.77.1-debug/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

