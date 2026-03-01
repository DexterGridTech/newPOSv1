#include <jni.h>
#include <fbjni/fbjni.h>
#include <ReactCommon/CallInvokerHolder.h>
// ScriptExecution temporarily disabled for testing
// #include "ScriptExecutionModule.h"

using namespace facebook;

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *) {
    return facebook::jni::initialize(vm, [] {
        // Module initialization will be done via TurboModuleRegistry
    });
}
