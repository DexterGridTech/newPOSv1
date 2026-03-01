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

std::string ScriptExecutionModule::computeScriptHash(const std::string& script) {
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256(reinterpret_cast<const unsigned char*>(script.c_str()),
           script.length(),
           hash);

    std::stringstream ss;
    for (int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
        ss << std::hex << std::setw(2) << std::setfill('0')
           << static_cast<int>(hash[i]);
    }

    return ss.str();
}

void ScriptExecutionModule::evictLRUCache() {
    if (bytecodeCache_.size() < MAX_CACHE_SIZE) {
        return;
    }

    // Find LRU entry
    std::string lruKey;
    uint64_t oldestTime = UINT64_MAX;

    for (const auto& [key, entry] : bytecodeCache_) {
        if (entry.lastUsed < oldestTime) {
            oldestTime = entry.lastUsed;
            lruKey = key;
        }
    }

    if (!lruKey.empty()) {
        bytecodeCache_.erase(lruKey);
        LOGI("Evicted LRU cache entry: %s", lruKey.substr(0, 8).c_str());
    }
}

void ScriptExecutionModule::updateCacheEntry(const std::string& hash) {
    auto it = bytecodeCache_.find(hash);
    if (it != bytecodeCache_.end()) {
        it->second.lastUsed = std::chrono::steady_clock::now().time_since_epoch().count();
        it->second.useCount++;
    }
}

jsi::Value ScriptExecutionModule::executeScript(
    jsi::Runtime& rt,
    const jsi::String& script,
    const jsi::String& paramsJson,
    const jsi::String& globalsJson,
    const jsi::Array& nativeFuncNames,
    double timeout
) {
    totalExecutions_++;

    std::string scriptStr = script.utf8(rt);
    std::string paramsStr = paramsJson.utf8(rt);
    std::string globalsStr = globalsJson.utf8(rt);

    // Compute script hash for caching
    std::string hash = computeScriptHash(scriptStr);

    // Acquire engine from pool
    QuickJSEngine* engine = acquireEngine();
    if (!engine) {
        return jsi::String::createFromUtf8(rt,
            R"({"success":false,"error":"ENGINE_POOL_EXHAUSTED","message":"No available engines"})");
    }

    // Set timeout
    engine->setTimeout(static_cast<uint32_t>(timeout));

    // Continue in next step...
    return jsi::Value::undefined();
}

} // namespace react
} // namespace facebook
