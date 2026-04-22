if(NOT TARGET react-native-nitro-modules::NitroModules)
add_library(react-native-nitro-modules::NitroModules SHARED IMPORTED)
set_target_properties(react-native-nitro-modules::NitroModules PROPERTIES
    IMPORTED_LOCATION "/Users/dexter/Documents/workspace/idea/newPOSv1/4-assembly/android/mixc-retail-rn84v2/node_modules/react-native-nitro-modules/android/build/intermediates/cxx/RelWithDebInfo/5q1o6u5r/obj/armeabi-v7a/libNitroModules.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/dexter/Documents/workspace/idea/newPOSv1/4-assembly/android/mixc-retail-rn84v2/node_modules/react-native-nitro-modules/android/build/headers/nitromodules"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

