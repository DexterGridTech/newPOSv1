#include "ScriptExecutionModule.h"
#include <openssl/sha.h>
#include <sstream>
#include <iomanip>
#include <android/log.h>

#define LOG_TAG "ScriptExecutionModule"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace facebook {
namespace react {

ScriptExecutionModule::ScriptExecutionModule(std::shared_ptr<CallInvoker> jsInvoker)
    : TurboModule("NativeScriptsTurboModule", jsInvoker) {
    // Initialize engine pool
    for (size_t i = 0; i < POOL_SIZE; i++) {
        auto engine = std::make_unique<QuickJSEngine>();
        if (engine->createContext()) {
            enginePool_.push_back(std::move(engine));
        } else {
            LOGE("Failed to create engine %zu", i);
        }
    }
    LOGI("ScriptExecutionModule initialized with %zu engines", enginePool_.size());
}

ScriptExecutionModule::~ScriptExecutionModule() {
    std::lock_guard<std::mutex> lock(poolMutex_);
    enginePool_.clear();
    LOGI("ScriptExecutionModule destroyed");
}

} // namespace react
} // namespace facebook
