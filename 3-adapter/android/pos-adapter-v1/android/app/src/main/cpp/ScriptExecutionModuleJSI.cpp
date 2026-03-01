#include "ScriptExecutionModule.h"
#include <ReactCommon/TurboModuleUtils.h>

namespace facebook {
namespace react {

static jsi::Value __hostFunction_ScriptExecutionModule_executeScript(
    jsi::Runtime& rt,
    TurboModule& turboModule,
    const jsi::Value* args,
    size_t count
) {
    auto& module = static_cast<ScriptExecutionModule&>(turboModule);
    return module.executeScript(
        rt,
        args[0].getString(rt),
        args[1].getString(rt),
        args[2].getString(rt),
        args[3].getObject(rt).getArray(rt),
        args[4].getNumber()
    );
}

static jsi::Value __hostFunction_ScriptExecutionModule_getStats(
    jsi::Runtime& rt,
    TurboModule& turboModule,
    const jsi::Value* args,
    size_t count
) {
    auto& module = static_cast<ScriptExecutionModule&>(turboModule);
    return module.getStats(rt);
}

static jsi::Value __hostFunction_ScriptExecutionModule_clearCache(
    jsi::Runtime& rt,
    TurboModule& turboModule,
    const jsi::Value* args,
    size_t count
) {
    auto& module = static_cast<ScriptExecutionModule&>(turboModule);
    module.clearCache(rt);
    return jsi::Value::undefined();
}

ScriptExecutionModule::ScriptExecutionModule(std::shared_ptr<CallInvoker> jsInvoker)
    : TurboModule("NativeScriptsTurboModule", jsInvoker) {
    methodMap_["executeScript"] = MethodMetadata{5, __hostFunction_ScriptExecutionModule_executeScript};
    methodMap_["getStats"] = MethodMetadata{0, __hostFunction_ScriptExecutionModule_getStats};
    methodMap_["clearCache"] = MethodMetadata{0, __hostFunction_ScriptExecutionModule_clearCache};
}

} // namespace react
} // namespace facebook
