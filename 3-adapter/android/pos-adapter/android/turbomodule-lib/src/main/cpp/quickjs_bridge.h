#ifndef QUICKJS_BRIDGE_H
#define QUICKJS_BRIDGE_H

#include <jni.h>
#include <stdint.h>
#include <stdatomic.h>
#include "quickjs/quickjs.h"

#ifdef __cplusplus
extern "C" {
#endif

// ─── 挂起的 nativeCall 队列节点 ───────────────────────────────────────────────
typedef struct PendingCall {
    char *call_id;
    char *func_name;
    char *args_json;
    struct PendingCall *next;
} PendingCall;

// ─── 挂起的 Promise（等待 resolveNativeCall 注入结果）────────────────────────
typedef struct PendingPromise {
    char   *call_id;
    JSValue resolve_val;
    JSValue reject_val;
    struct PendingPromise *next;
} PendingPromise;

// ─── 单次执行上下文 ───────────────────────────────────────────────────────────
typedef struct BridgeContext {
    JSRuntime *rt;
    JSContext *ctx;
    char      *execution_id;

    char **native_func_names;
    int    native_func_count;

    PendingCall    *pending_queue_head;
    PendingCall    *pending_queue_tail;
    PendingPromise *promise_list;

    JSValue    top_result_val;
    int        is_settled;       // 0=pending, 1=settled, -1=error
    char      *error_msg;

    atomic_int interrupt_flag;
} BridgeContext;

#define PUMP_PENDING  0
#define PUMP_SETTLED  1
#define PUMP_ERROR   -1

// ─── JNI 导出函数声明 ─────────────────────────────────────────────────────────
JNIEXPORT jlong JNICALL
Java_com_impos2_posadapter_turbomodules_QuickJsEngine_createContext(
    JNIEnv *env, jobject thiz,
    jstring execution_id, jstring script,
    jstring params_json, jstring globals_json,
    jobjectArray native_func_names);

JNIEXPORT jint JNICALL
Java_com_impos2_posadapter_turbomodules_QuickJsEngine_pumpEventLoop(
    JNIEnv *env, jobject thiz, jlong handle);

JNIEXPORT jobject JNICALL
Java_com_impos2_posadapter_turbomodules_QuickJsEngine_pollPendingNativeCall(
    JNIEnv *env, jobject thiz, jlong handle);

JNIEXPORT void JNICALL
Java_com_impos2_posadapter_turbomodules_QuickJsEngine_resolveNativeCall(
    JNIEnv *env, jobject thiz, jlong handle,
    jstring call_id, jstring result_json);

JNIEXPORT void JNICALL
Java_com_impos2_posadapter_turbomodules_QuickJsEngine_rejectNativeCall(
    JNIEnv *env, jobject thiz, jlong handle,
    jstring call_id, jstring error_msg);

JNIEXPORT jstring JNICALL
Java_com_impos2_posadapter_turbomodules_QuickJsEngine_getResult(
    JNIEnv *env, jobject thiz, jlong handle);

JNIEXPORT jstring JNICALL
Java_com_impos2_posadapter_turbomodules_QuickJsEngine_getError(
    JNIEnv *env, jobject thiz, jlong handle);

JNIEXPORT void JNICALL
Java_com_impos2_posadapter_turbomodules_QuickJsEngine_interrupt(
    JNIEnv *env, jobject thiz, jlong handle);

JNIEXPORT void JNICALL
Java_com_impos2_posadapter_turbomodules_QuickJsEngine_destroyContext(
    JNIEnv *env, jobject thiz, jlong handle);

#ifdef __cplusplus
}
#endif

#endif // QUICKJS_BRIDGE_H
