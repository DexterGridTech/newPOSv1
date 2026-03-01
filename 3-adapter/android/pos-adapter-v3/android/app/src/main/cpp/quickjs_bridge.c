#include "quickjs_bridge.h"
#include <jni.h>
#include <android/log.h>
#include <stdlib.h>
#include <string.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdatomic.h>
#include <time.h>

#define LOG_TAG "QuickJsBridge"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO,  LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

static char *dup_jstring(JNIEnv *env, jstring js) {
    if (!js) return NULL;
    const char *tmp = (*env)->GetStringUTFChars(env, js, NULL);
    if (!tmp) return NULL;
    char *result = strdup(tmp);
    (*env)->ReleaseStringUTFChars(env, js, tmp);
    return result;
}

static void generate_call_id(const char *execution_id, char *out, size_t out_size) {
    uint8_t rand_bytes[8];
    int fd = open("/dev/urandom", O_RDONLY);
    if (fd >= 0) {
        ssize_t n = read(fd, rand_bytes, sizeof(rand_bytes));
        close(fd);
        if (n != (ssize_t)sizeof(rand_bytes)) {
            uint64_t ts = (uint64_t)time(NULL);
            memcpy(rand_bytes + n, &ts, sizeof(rand_bytes) - (size_t)n);
        }
    } else {
        uint64_t ts = (uint64_t)time(NULL);
        memcpy(rand_bytes, &ts, 8);
    }
    snprintf(out, out_size, "%s:%02x%02x%02x%02x%02x%02x%02x%02x",
             execution_id,
             rand_bytes[0], rand_bytes[1], rand_bytes[2], rand_bytes[3],
             rand_bytes[4], rand_bytes[5], rand_bytes[6], rand_bytes[7]);
}

// ─── 中断处理器 ───────────────────────────────────────────────────────────────

static int interrupt_handler(JSRuntime *rt, void *opaque) {
    BridgeContext *bridge = (BridgeContext *)opaque;
    return atomic_load(&bridge->interrupt_flag);
}

// ─── pending nativeCall 队列 ──────────────────────────────────────────────────

static void pending_call_enqueue(BridgeContext *bridge,
                                  const char *call_id,
                                  const char *func_name,
                                  const char *args_json) {
    PendingCall *node = (PendingCall *)malloc(sizeof(PendingCall));
    if (!node) return;
    node->call_id   = strdup(call_id);
    node->func_name = strdup(func_name);
    node->args_json = strdup(args_json ? args_json : "[]");
    node->next      = NULL;
    if (bridge->pending_queue_tail) {
        bridge->pending_queue_tail->next = node;
    } else {
        bridge->pending_queue_head = node;
    }
    bridge->pending_queue_tail = node;
}

static PendingCall *pending_call_dequeue(BridgeContext *bridge) {
    if (!bridge->pending_queue_head) return NULL;
    PendingCall *node = bridge->pending_queue_head;
    bridge->pending_queue_head = node->next;
    if (!bridge->pending_queue_head) bridge->pending_queue_tail = NULL;
    node->next = NULL;
    return node;
}

static void pending_call_free(PendingCall *node) {
    if (!node) return;
    free(node->call_id);
    free(node->func_name);
    free(node->args_json);
    free(node);
}

// ─── pending Promise 表 ───────────────────────────────────────────────────────

static void promise_store(BridgeContext *bridge,
                           const char *call_id,
                           JSValue resolve, JSValue reject) {
    PendingPromise *node = (PendingPromise *)malloc(sizeof(PendingPromise));
    if (!node) {
        JS_FreeValue(bridge->ctx, resolve);
        JS_FreeValue(bridge->ctx, reject);
        return;
    }
    node->call_id     = strdup(call_id);
    node->resolve_val = resolve;
    node->reject_val  = reject;
    node->next        = bridge->promise_list;
    bridge->promise_list = node;
}

static PendingPromise *promise_find_and_remove(BridgeContext *bridge, const char *call_id) {
    PendingPromise **pp = &bridge->promise_list;
    while (*pp) {
        if (strcmp((*pp)->call_id, call_id) == 0) {
            PendingPromise *found = *pp;
            *pp = found->next;
            found->next = NULL;
            return found;
        }
        pp = &(*pp)->next;
    }
    return NULL;
}

static void promise_free(JSContext *ctx, PendingPromise *node) {
    if (!node) return;
    JS_FreeValue(ctx, node->resolve_val);
    JS_FreeValue(ctx, node->reject_val);
    free(node->call_id);
    free(node);
}

// ─── nativeFunction 桥接 ──────────────────────────────────────────────────────

static JSValue native_func_bridge(JSContext *ctx, JSValueConst this_val,
                                   int argc, JSValueConst *argv, int magic) {
    BridgeContext *bridge = (BridgeContext *)JS_GetContextOpaque(ctx);
    if (!bridge || magic < 0 || magic >= bridge->native_func_count) {
        return JS_ThrowTypeError(ctx, "Invalid native function index");
    }
    const char *func_name = bridge->native_func_names[magic];

    char call_id[192];
    generate_call_id(bridge->execution_id, call_id, sizeof(call_id));

    // 序列化参数为 JSON 数组
    JSValue args_array = JS_NewArray(ctx);
    for (int i = 0; i < argc; i++) {
        JS_SetPropertyUint32(ctx, args_array, (uint32_t)i, JS_DupValue(ctx, argv[i]));
    }
    JSValue json_str_val = JS_JSONStringify(ctx, args_array, JS_UNDEFINED, JS_UNDEFINED);
    JS_FreeValue(ctx, args_array);

    const char *args_json = NULL;
    if (!JS_IsException(json_str_val)) {
        args_json = JS_ToCString(ctx, json_str_val);
    }
    JS_FreeValue(ctx, json_str_val);

    pending_call_enqueue(bridge, call_id, func_name, args_json ? args_json : "[]");
    if (args_json) JS_FreeCString(ctx, args_json);

    // 创建 Promise
    JSValue resolving_funcs[2];
    JSValue promise = JS_NewPromiseCapability(ctx, resolving_funcs);
    if (JS_IsException(promise)) {
        return promise;
    }
    // promise_store 接管 resolve/reject 的所有权
    promise_store(bridge, call_id, resolving_funcs[0], resolving_funcs[1]);
    return promise;
}

// ─── 脚本包装为 IIFE ──────────────────────────────────────────────────────────

static char *wrap_script(const char *script) {
    size_t script_len = strlen(script);
    // "(function(params){" + script + "})"  + null
    size_t total = 18 + script_len + 3;
    char *wrapped = (char *)malloc(total);
    if (!wrapped) return NULL;
    snprintf(wrapped, total, "(function(params){%s})", script);
    return wrapped;
}

// ─── createContext ────────────────────────────────────────────────────────────

JNIEXPORT jlong JNICALL
Java_com_adapterrn84_turbomodules_QuickJsEngine_createContext(
    JNIEnv *env, jobject thiz,
    jstring j_execution_id, jstring j_script,
    jstring j_params_json, jstring j_globals_json,
    jobjectArray j_native_func_names)
{
    BridgeContext *bridge = (BridgeContext *)calloc(1, sizeof(BridgeContext));
    if (!bridge) return 0;

    bridge->execution_id = dup_jstring(env, j_execution_id);
    atomic_init(&bridge->interrupt_flag, 0);

    // 收集 nativeFunction 名称
    bridge->native_func_count = j_native_func_names
        ? (int)(*env)->GetArrayLength(env, j_native_func_names) : 0;
    if (bridge->native_func_count > 0) {
        bridge->native_func_names = (char **)calloc(
            bridge->native_func_count, sizeof(char *));
        for (int i = 0; i < bridge->native_func_count; i++) {
            jstring js = (jstring)(*env)->GetObjectArrayElement(
                env, j_native_func_names, i);
            bridge->native_func_names[i] = dup_jstring(env, js);
            (*env)->DeleteLocalRef(env, js);
        }
    }

    // 创建 JSRuntime + JSContext
    JSRuntime *rt = JS_NewRuntime();
    JS_SetMemoryLimit(rt, 32 * 1024 * 1024);
    JS_SetMaxStackSize(rt, 512 * 1024);
    JS_SetInterruptHandler(rt, interrupt_handler, bridge);

    JSContext *ctx = JS_NewContext(rt);
    JS_SetContextOpaque(ctx, bridge);
    bridge->rt  = rt;
    bridge->ctx = ctx;

    // 初始化 top_result_val 为 JS_UNDEFINED（必须在 ctx 创建后）
    bridge->top_result_val = JS_UNDEFINED;

    // 注入 params 到全局
    char *params_json = dup_jstring(env, j_params_json);
    JSValue params_val = JS_ParseJSON(ctx,
        params_json ? params_json : "{}",
        params_json ? strlen(params_json) : 2, "<params>");
    free(params_json);
    if (JS_IsException(params_val)) params_val = JS_NewObject(ctx);

    {
        JSValue global = JS_GetGlobalObject(ctx);
        JS_SetPropertyStr(ctx, global, "params", JS_DupValue(ctx, params_val));
        JS_FreeValue(ctx, global);
    }

    // 注入 globals（展开到全局）
    char *globals_json = dup_jstring(env, j_globals_json);
    if (globals_json && strlen(globals_json) > 2) {
        JSValue globals_val = JS_ParseJSON(ctx, globals_json,
            strlen(globals_json), "<globals>");
        if (!JS_IsException(globals_val) && JS_IsObject(globals_val)) {
            JSPropertyEnum *props;
            uint32_t prop_count;
            if (JS_GetOwnPropertyNames(ctx, &props, &prop_count,
                    globals_val, JS_GPN_STRING_MASK) == 0) {
                JSValue global = JS_GetGlobalObject(ctx);
                for (uint32_t i = 0; i < prop_count; i++) {
                    JSValue v = JS_GetProperty(ctx, globals_val, props[i].atom);
                    const char *key = JS_AtomToCString(ctx, props[i].atom);
                    if (key) {
                        JS_SetPropertyStr(ctx, global, key, v);
                    } else {
                        JS_FreeValue(ctx, v);
                    }
                    JS_FreeCString(ctx, key);
                    JS_FreeAtom(ctx, props[i].atom);
                }
                JS_FreeValue(ctx, global);
                js_free(ctx, props);
            }
        }
        JS_FreeValue(ctx, globals_val);
    }
    free(globals_json);

    // 注册 nativeFunction 桥接函数到全局
    {
        JSValue global = JS_GetGlobalObject(ctx);
        for (int i = 0; i < bridge->native_func_count; i++) {
            JSValue fn = JS_NewCFunctionMagic(ctx, native_func_bridge,
                bridge->native_func_names[i], 0, JS_CFUNC_generic_magic, i);
            JS_SetPropertyStr(ctx, global, bridge->native_func_names[i], fn);
        }
        JS_FreeValue(ctx, global);
    }

    // 包装脚本为 IIFE 并编译
    char *script_str = dup_jstring(env, j_script);
    char *wrapped = wrap_script(script_str ? script_str : "");
    free(script_str);

    if (!wrapped) {
        bridge->error_msg = strdup("out of memory");
        bridge->is_settled = PUMP_ERROR;
        JS_FreeValue(ctx, params_val);
        return (jlong)(uintptr_t)bridge;
    }

    JSValue fn_val = JS_Eval(ctx, wrapped, strlen(wrapped),
        "<script>", JS_EVAL_TYPE_GLOBAL);
    free(wrapped);

    if (JS_IsException(fn_val)) {
        JSValue exc = JS_GetException(ctx);
        const char *msg = JS_ToCString(ctx, exc);
        bridge->error_msg = strdup(msg ? msg : "compile error");
        JS_FreeCString(ctx, msg);
        JS_FreeValue(ctx, exc);
        bridge->is_settled = PUMP_ERROR;
        JS_FreeValue(ctx, params_val);
        return (jlong)(uintptr_t)bridge;
    }

    // 调用 IIFE，传入 params
    JSValue result = JS_Call(ctx, fn_val, JS_UNDEFINED, 1, &params_val);
    JS_FreeValue(ctx, fn_val);
    JS_FreeValue(ctx, params_val);

    if (JS_IsException(result)) {
        JSValue exc = JS_GetException(ctx);
        const char *msg = JS_ToCString(ctx, exc);
        bridge->error_msg = strdup(msg ? msg : "runtime error");
        JS_FreeCString(ctx, msg);
        JS_FreeValue(ctx, exc);
        bridge->is_settled = PUMP_ERROR;
        // top_result_val 保持 JS_UNDEFINED，destroyContext 可安全 free
    } else {
        bridge->top_result_val = result;  // 直接赋值，转移所有权
        // 同步非对象结果直接 settled
        if (!JS_IsObject(result)) {
            bridge->is_settled = PUMP_SETTLED;
        }
    }

    return (jlong)(uintptr_t)bridge;
}

// ─── pumpEventLoop ────────────────────────────────────────────────────────────

JNIEXPORT jint JNICALL
Java_com_adapterrn84_turbomodules_QuickJsEngine_pumpEventLoop(
    JNIEnv *env, jobject thiz, jlong handle)
{
    BridgeContext *bridge = (BridgeContext *)(uintptr_t)handle;
    if (!bridge) return PUMP_ERROR;
    if (bridge->is_settled != 0) return bridge->is_settled;

    JSContext *ctx = bridge->ctx;
    JSRuntime *rt  = bridge->rt;

    // 推进所有 pending job
    JSContext *ctx1 = NULL;
    int err;
    while ((err = JS_ExecutePendingJob(rt, &ctx1)) > 0) {}

    if (err < 0) {
        JSValue exc = JS_GetException(ctx1 ? ctx1 : ctx);
        const char *msg = JS_ToCString(ctx, exc);
        bridge->error_msg = strdup(msg ? msg : "job error");
        JS_FreeCString(ctx, msg);
        JS_FreeValue(ctx, exc);
        bridge->is_settled = PUMP_ERROR;
        return PUMP_ERROR;
    }

    // 还有 pending nativeCall，等待 Kotlin 处理
    if (bridge->pending_queue_head != NULL) {
        return PUMP_PENDING;
    }

    JSValue top = bridge->top_result_val;

    if (!JS_IsObject(top)) {
        bridge->is_settled = PUMP_SETTLED;
        return PUMP_SETTLED;
    }

    // 检查是否为 Promise
    int promise_state = JS_PromiseState(ctx, top);
    if (promise_state < 0) {
        // 普通对象，直接 settled
        bridge->is_settled = PUMP_SETTLED;
        return PUMP_SETTLED;
    }

    if (promise_state == 1) {
        // fulfilled：解包结果值
        JSValue resolved = JS_PromiseResult(ctx, top);
        JS_FreeValue(ctx, top);
        bridge->top_result_val = resolved;
        bridge->is_settled = PUMP_SETTLED;
        return PUMP_SETTLED;
    } else if (promise_state == 2) {
        // rejected：提取错误
        JSValue reason = JS_PromiseResult(ctx, top);
        JS_FreeValue(ctx, top);
        bridge->top_result_val = JS_UNDEFINED;
        const char *msg = JS_ToCString(ctx, reason);
        bridge->error_msg = strdup(msg ? msg : "Promise rejected");
        JS_FreeCString(ctx, msg);
        JS_FreeValue(ctx, reason);
        bridge->is_settled = PUMP_ERROR;
        return PUMP_ERROR;
    }

    return PUMP_PENDING;
}

// ─── pollPendingNativeCall ────────────────────────────────────────────────────

JNIEXPORT jobject JNICALL
Java_com_adapterrn84_turbomodules_QuickJsEngine_pollPendingNativeCall(
    JNIEnv *env, jobject thiz, jlong handle)
{
    BridgeContext *bridge = (BridgeContext *)(uintptr_t)handle;
    if (!bridge) return NULL;

    PendingCall *node = pending_call_dequeue(bridge);
    if (!node) return NULL;

    jclass cls = (*env)->FindClass(env,
        "com/adapterrn84/turbomodules/PendingNativeCall");
    if (!cls) { pending_call_free(node); return NULL; }

    jmethodID ctor = (*env)->GetMethodID(env, cls, "<init>",
        "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V");
    if (!ctor) { pending_call_free(node); (*env)->DeleteLocalRef(env, cls); return NULL; }

    jstring j_call_id   = (*env)->NewStringUTF(env, node->call_id);
    jstring j_func_name = (*env)->NewStringUTF(env, node->func_name);
    jstring j_args_json = (*env)->NewStringUTF(env, node->args_json);

    jobject result = (*env)->NewObject(env, cls, ctor,
        j_call_id, j_func_name, j_args_json);

    (*env)->DeleteLocalRef(env, j_call_id);
    (*env)->DeleteLocalRef(env, j_func_name);
    (*env)->DeleteLocalRef(env, j_args_json);
    (*env)->DeleteLocalRef(env, cls);
    pending_call_free(node);
    return result;
}

// ─── resolveNativeCall ────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_adapterrn84_turbomodules_QuickJsEngine_resolveNativeCall(
    JNIEnv *env, jobject thiz, jlong handle,
    jstring j_call_id, jstring j_result_json)
{
    BridgeContext *bridge = (BridgeContext *)(uintptr_t)handle;
    if (!bridge) return;

    JSContext *ctx = bridge->ctx;
    char *call_id     = dup_jstring(env, j_call_id);
    char *result_json = dup_jstring(env, j_result_json);

    PendingPromise *pp = promise_find_and_remove(bridge, call_id);
    free(call_id);
    if (!pp) { free(result_json); return; }

    JSValue result_val = JS_ParseJSON(ctx,
        result_json ? result_json : "null",
        result_json ? strlen(result_json) : 4, "<result>");
    free(result_json);
    if (JS_IsException(result_val)) result_val = JS_NULL;

    JSValue ret = JS_Call(ctx, pp->resolve_val, JS_UNDEFINED, 1, &result_val);
    JS_FreeValue(ctx, ret);
    JS_FreeValue(ctx, result_val);
    promise_free(ctx, pp);
}

// ─── rejectNativeCall ─────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_adapterrn84_turbomodules_QuickJsEngine_rejectNativeCall(
    JNIEnv *env, jobject thiz, jlong handle,
    jstring j_call_id, jstring j_error_msg)
{
    BridgeContext *bridge = (BridgeContext *)(uintptr_t)handle;
    if (!bridge) return;

    JSContext *ctx = bridge->ctx;
    char *call_id   = dup_jstring(env, j_call_id);
    char *error_msg = dup_jstring(env, j_error_msg);

    PendingPromise *pp = promise_find_and_remove(bridge, call_id);
    free(call_id);
    if (!pp) { free(error_msg); return; }

    JSValue err_val = JS_NewError(ctx);
    JS_SetPropertyStr(ctx, err_val, "message",
        JS_NewString(ctx, error_msg ? error_msg : "nativeFunction error"));
    free(error_msg);

    JSValue ret = JS_Call(ctx, pp->reject_val, JS_UNDEFINED, 1, &err_val);
    JS_FreeValue(ctx, ret);
    JS_FreeValue(ctx, err_val);
    promise_free(ctx, pp);
}

// ─── getResult ────────────────────────────────────────────────────────────────

JNIEXPORT jstring JNICALL
Java_com_adapterrn84_turbomodules_QuickJsEngine_getResult(
    JNIEnv *env, jobject thiz, jlong handle)
{
    BridgeContext *bridge = (BridgeContext *)(uintptr_t)handle;
    if (!bridge) return (*env)->NewStringUTF(env, "null");

    JSContext *ctx = bridge->ctx;
    JSValue json = JS_JSONStringify(ctx, bridge->top_result_val,
                                    JS_UNDEFINED, JS_UNDEFINED);
    if (JS_IsException(json) || JS_IsUndefined(json)) {
        JS_FreeValue(ctx, json);
        return (*env)->NewStringUTF(env, "null");
    }
    const char *str = JS_ToCString(ctx, json);
    jstring jresult = (*env)->NewStringUTF(env, str ? str : "null");
    JS_FreeCString(ctx, str);
    JS_FreeValue(ctx, json);
    return jresult;
}

// ─── getError ─────────────────────────────────────────────────────────────────

JNIEXPORT jstring JNICALL
Java_com_adapterrn84_turbomodules_QuickJsEngine_getError(
    JNIEnv *env, jobject thiz, jlong handle)
{
    BridgeContext *bridge = (BridgeContext *)(uintptr_t)handle;
    if (!bridge || !bridge->error_msg) {
        return (*env)->NewStringUTF(env, "unknown error");
    }
    return (*env)->NewStringUTF(env, bridge->error_msg);
}

// ─── interrupt ────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_adapterrn84_turbomodules_QuickJsEngine_interrupt(
    JNIEnv *env, jobject thiz, jlong handle)
{
    BridgeContext *bridge = (BridgeContext *)(uintptr_t)handle;
    if (bridge) atomic_store(&bridge->interrupt_flag, 1);
}

// ─── compileScript ────────────────────────────────────────────────────────────
// 编译脚本为字节码，返回 jbyteArray；失败返回 null

JNIEXPORT jbyteArray JNICALL
Java_com_adapterrn84_turbomodules_QuickJsEngine_compileScript(
    JNIEnv *env, jobject thiz, jstring j_script)
{
    char *script_str = dup_jstring(env, j_script);
    char *wrapped = wrap_script(script_str ? script_str : "");
    free(script_str);
    if (!wrapped) return NULL;

    JSRuntime *rt = JS_NewRuntime();
    JSContext *ctx = JS_NewContext(rt);

    // JS_EVAL_FLAG_COMPILE_ONLY：只编译，不执行
    JSValue fn = JS_Eval(ctx, wrapped, strlen(wrapped), "<script>",
                         JS_EVAL_TYPE_GLOBAL | JS_EVAL_FLAG_COMPILE_ONLY);
    free(wrapped);

    if (JS_IsException(fn)) {
        JS_FreeValue(ctx, fn);
        JS_FreeContext(ctx);
        JS_FreeRuntime(rt);
        return NULL;
    }

    size_t bytecode_len = 0;
    uint8_t *bytecode = JS_WriteObject(ctx, &bytecode_len, fn,
                                       JS_WRITE_OBJ_BYTECODE);
    JS_FreeValue(ctx, fn);

    jbyteArray result = NULL;
    if (bytecode && bytecode_len > 0) {
        result = (*env)->NewByteArray(env, (jsize)bytecode_len);
        if (result) {
            (*env)->SetByteArrayRegion(env, result, 0, (jsize)bytecode_len,
                                       (const jbyte *)bytecode);
        }
        js_free(ctx, bytecode);
    }

    JS_FreeContext(ctx);
    JS_FreeRuntime(rt);
    return result;
}

// ─── createContextFromBytecode ────────────────────────────────────────────────
// 从字节码创建执行上下文，跳过编译步骤

JNIEXPORT jlong JNICALL
Java_com_adapterrn84_turbomodules_QuickJsEngine_createContextFromBytecode(
    JNIEnv *env, jobject thiz,
    jstring j_execution_id, jbyteArray j_bytecode,
    jstring j_params_json, jstring j_globals_json,
    jobjectArray j_native_func_names)
{
    BridgeContext *bridge = (BridgeContext *)calloc(1, sizeof(BridgeContext));
    if (!bridge) return 0;

    bridge->execution_id = dup_jstring(env, j_execution_id);
    atomic_init(&bridge->interrupt_flag, 0);

    bridge->native_func_count = j_native_func_names
        ? (int)(*env)->GetArrayLength(env, j_native_func_names) : 0;
    if (bridge->native_func_count > 0) {
        bridge->native_func_names = (char **)calloc(
            bridge->native_func_count, sizeof(char *));
        for (int i = 0; i < bridge->native_func_count; i++) {
            jstring js = (jstring)(*env)->GetObjectArrayElement(
                env, j_native_func_names, i);
            bridge->native_func_names[i] = dup_jstring(env, js);
            (*env)->DeleteLocalRef(env, js);
        }
    }

    JSRuntime *rt = JS_NewRuntime();
    JS_SetMemoryLimit(rt, 32 * 1024 * 1024);
    JS_SetMaxStackSize(rt, 512 * 1024);
    JS_SetInterruptHandler(rt, interrupt_handler, bridge);

    JSContext *ctx = JS_NewContext(rt);
    JS_SetContextOpaque(ctx, bridge);
    bridge->rt  = rt;
    bridge->ctx = ctx;
    bridge->top_result_val = JS_UNDEFINED;

    // 注入 params
    char *params_json = dup_jstring(env, j_params_json);
    JSValue params_val = JS_ParseJSON(ctx,
        params_json ? params_json : "{}",
        params_json ? strlen(params_json) : 2, "<params>");
    free(params_json);
    if (JS_IsException(params_val)) params_val = JS_NewObject(ctx);

    {
        JSValue global = JS_GetGlobalObject(ctx);
        JS_SetPropertyStr(ctx, global, "params", JS_DupValue(ctx, params_val));
        JS_FreeValue(ctx, global);
    }

    // 注入 globals
    char *globals_json = dup_jstring(env, j_globals_json);
    if (globals_json && strlen(globals_json) > 2) {
        JSValue globals_val = JS_ParseJSON(ctx, globals_json,
            strlen(globals_json), "<globals>");
        if (!JS_IsException(globals_val) && JS_IsObject(globals_val)) {
            JSPropertyEnum *props;
            uint32_t prop_count;
            if (JS_GetOwnPropertyNames(ctx, &props, &prop_count,
                    globals_val, JS_GPN_STRING_MASK) == 0) {
                JSValue global = JS_GetGlobalObject(ctx);
                for (uint32_t i = 0; i < prop_count; i++) {
                    JSValue v = JS_GetProperty(ctx, globals_val, props[i].atom);
                    const char *key = JS_AtomToCString(ctx, props[i].atom);
                    if (key) JS_SetPropertyStr(ctx, global, key, v);
                    else JS_FreeValue(ctx, v);
                    JS_FreeCString(ctx, key);
                    JS_FreeAtom(ctx, props[i].atom);
                }
                JS_FreeValue(ctx, global);
                js_free(ctx, props);
            }
        }
        JS_FreeValue(ctx, globals_val);
    }
    free(globals_json);

    // 注册 nativeFunction
    {
        JSValue global = JS_GetGlobalObject(ctx);
        for (int i = 0; i < bridge->native_func_count; i++) {
            JSValue fn = JS_NewCFunctionMagic(ctx, native_func_bridge,
                bridge->native_func_names[i], 0, JS_CFUNC_generic_magic, i);
            JS_SetPropertyStr(ctx, global, bridge->native_func_names[i], fn);
        }
        JS_FreeValue(ctx, global);
    }

    // 从字节码读取函数对象
    jsize bytecode_len = (*env)->GetArrayLength(env, j_bytecode);
    jbyte *bytecode_buf = (*env)->GetByteArrayElements(env, j_bytecode, NULL);

    JSValue fn_val = JS_ReadObject(ctx, (const uint8_t *)bytecode_buf,
                                   (size_t)bytecode_len, JS_READ_OBJ_BYTECODE);
    (*env)->ReleaseByteArrayElements(env, j_bytecode, bytecode_buf, JNI_ABORT);

    if (JS_IsException(fn_val)) {
        JSValue exc = JS_GetException(ctx);
        const char *msg = JS_ToCString(ctx, exc);
        bridge->error_msg = strdup(msg ? msg : "bytecode load error");
        JS_FreeCString(ctx, msg);
        JS_FreeValue(ctx, exc);
        bridge->is_settled = PUMP_ERROR;
        JS_FreeValue(ctx, params_val);
        return (jlong)(uintptr_t)bridge;
    }

    // JS_ReadObject 加载的是脚本字节码，用 JS_EvalFunction 执行（它会消耗 fn_val 的所有权）
    // 执行后得到 IIFE 返回的函数对象，再 JS_Call 调用它传入 params
    JSValue iife_fn = JS_EvalFunction(ctx, fn_val); // fn_val 所有权转移，无需 FreeValue
    if (JS_IsException(iife_fn)) {
        JSValue exc = JS_GetException(ctx);
        const char *msg = JS_ToCString(ctx, exc);
        bridge->error_msg = strdup(msg ? msg : "bytecode eval error");
        JS_FreeCString(ctx, msg);
        JS_FreeValue(ctx, exc);
        bridge->is_settled = PUMP_ERROR;
        JS_FreeValue(ctx, params_val);
        return (jlong)(uintptr_t)bridge;
    }
    JSValue result = JS_Call(ctx, iife_fn, JS_UNDEFINED, 1, &params_val);
    JS_FreeValue(ctx, iife_fn);
    JS_FreeValue(ctx, params_val);

    if (JS_IsException(result)) {
        JSValue exc = JS_GetException(ctx);
        const char *msg = JS_ToCString(ctx, exc);
        bridge->error_msg = strdup(msg ? msg : "runtime error");
        JS_FreeCString(ctx, msg);
        JS_FreeValue(ctx, exc);
        bridge->is_settled = PUMP_ERROR;
    } else {
        bridge->top_result_val = result;
        if (!JS_IsObject(result)) bridge->is_settled = PUMP_SETTLED;
    }

    return (jlong)(uintptr_t)bridge;
}

JNIEXPORT void JNICALL
Java_com_adapterrn84_turbomodules_QuickJsEngine_destroyContext(
    JNIEnv *env, jobject thiz, jlong handle)
{
    BridgeContext *bridge = (BridgeContext *)(uintptr_t)handle;
    if (!bridge) return;

    JSContext *ctx = bridge->ctx;
    JSRuntime *rt  = bridge->rt;

    // 释放顶层结果值（已初始化为 JS_UNDEFINED，安全）
    JS_FreeValue(ctx, bridge->top_result_val);

    // 释放所有 pending promise
    PendingPromise *pp = bridge->promise_list;
    while (pp) {
        PendingPromise *next = pp->next;
        promise_free(ctx, pp);
        pp = next;
    }

    // 释放所有 pending call
    PendingCall *pc = bridge->pending_queue_head;
    while (pc) {
        PendingCall *next = pc->next;
        pending_call_free(pc);
        pc = next;
    }

    for (int i = 0; i < bridge->native_func_count; i++) {
        free(bridge->native_func_names[i]);
    }
    free(bridge->native_func_names);
    free(bridge->execution_id);
    free(bridge->error_msg);

    JS_FreeContext(ctx);
    JS_FreeRuntime(rt);
    free(bridge);
}
