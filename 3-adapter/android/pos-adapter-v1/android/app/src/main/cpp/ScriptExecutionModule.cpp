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

QuickJSEngine* ScriptExecutionModule::acquireEngine() {
    std::lock_guard<std::mutex> lock(poolMutex_);

    if (enginePool_.empty()) {
        LOGE("Engine pool exhausted");
        return nullptr;
    }

    // Take engine from pool
    auto engine = std::move(enginePool_.back());
    enginePool_.pop_back();

    LOGI("Acquired engine, %zu remaining in pool", enginePool_.size());
    return engine.release();
}

void ScriptExecutionModule::releaseEngine(QuickJSEngine* engine) {
    if (!engine) return;

    std::lock_guard<std::mutex> lock(poolMutex_);

    // Reset engine for reuse
    engine->reset();

    // Return to pool
    enginePool_.push_back(std::unique_ptr<QuickJSEngine>(engine));

    LOGI("Released engine, %zu in pool", enginePool_.size());
}

} // namespace react
} // namespace facebook
