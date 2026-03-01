#pragma once

#include <string>
#include <vector>
#include <functional>
#include <chrono>
#include <jsi/jsi.h>
#include "quickjs/quickjs.h"

namespace facebook {
namespace react {

class QuickJSEngine {
public:
    QuickJSEngine();
    ~QuickJSEngine();

    // Prevent copying
    QuickJSEngine(const QuickJSEngine&) = delete;
    QuickJSEngine& operator=(const QuickJSEngine&) = delete;

    // Context management
    bool createContext();
    void destroyContext();
    void reset();  // Reset for reuse

    // Script compilation and execution
    std::vector<uint8_t> compileScript(const std::string& script);
    bool executeFromBytecode(const std::vector<uint8_t>& bytecode);
    bool executeScript(const std::string& script);

    // Variable and function registration
    void setGlobalVariable(const std::string& name, const std::string& jsonValue);
    void registerNativeFunction(
        const std::string& name,
        std::function<jsi::Value(jsi::Runtime&, const jsi::Value*, size_t)> func,
        jsi::Runtime* runtime
    );

    // Result retrieval
    std::string getResult();
    std::string getError();
    std::string getStackTrace();
    bool hasError() const;

    // Timeout and interruption
    void setTimeout(uint32_t ms);
    void interrupt();

private:
    JSRuntime* runtime_;
    JSContext* context_;
    JSValue resultValue_;
    std::string errorMessage_;
    std::string stackTrace_;
    bool hasError_;

    // Timeout handling
    std::chrono::steady_clock::time_point startTime_;
    uint32_t timeoutMs_;

    // Native function storage
    struct NativeFunctionData {
        std::function<jsi::Value(jsi::Runtime&, const jsi::Value*, size_t)> func;
        jsi::Runtime* runtime;
    };
    std::vector<std::unique_ptr<NativeFunctionData>> nativeFunctions_;

    // Helper methods
    static int interruptHandler(JSRuntime* rt, void* opaque);
    JSValue convertJSIValueToQuickJS(const jsi::Value& value);
    jsi::Value convertQuickJSValueToJSI(JSValue value);
    void extractError();
};

} // namespace react
} // namespace facebook
