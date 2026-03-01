#pragma once

#include <ReactCommon/TurboModule.h>
#include <jsi/jsi.h>
#include <memory>
#include <unordered_map>
#include <vector>
#include <mutex>
#include "QuickJSEngine.h"

namespace facebook {
namespace react {

class ScriptExecutionModule : public TurboModule {
public:
    explicit ScriptExecutionModule(std::shared_ptr<CallInvoker> jsInvoker);
    ~ScriptExecutionModule() override;

    // TurboModule methods
    jsi::Value executeScript(
        jsi::Runtime& rt,
        const jsi::String& script,
        const jsi::String& paramsJson,
        const jsi::String& globalsJson,
        const jsi::Array& nativeFuncNames,
        double timeout
    );

    jsi::Object getStats(jsi::Runtime& rt);
    void clearCache(jsi::Runtime& rt);

    // Initialize method map (called from JSI binding)
    void initMethodMap();

private:
    // Bytecode cache
    struct CacheEntry {
        std::vector<uint8_t> bytecode;
        uint64_t lastUsed;
        uint32_t useCount;
    };
    std::unordered_map<std::string, CacheEntry> bytecodeCache_;
    std::mutex cacheMutex_;
    static constexpr size_t MAX_CACHE_SIZE = 100;

    // Engine pool
    std::vector<std::unique_ptr<QuickJSEngine>> enginePool_;
    std::mutex poolMutex_;
    static constexpr size_t POOL_SIZE = 3;

    // Statistics
    std::atomic<uint64_t> totalExecutions_{0};
    std::atomic<uint64_t> cacheHits_{0};
    std::atomic<uint64_t> cacheMisses_{0};

    // Helper methods
    std::string computeScriptHash(const std::string& script);
    QuickJSEngine* acquireEngine();
    void releaseEngine(QuickJSEngine* engine);
    void evictLRUCache();
    void updateCacheEntry(const std::string& hash);
};

} // namespace react
} // namespace facebook
