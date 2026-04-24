# Android Adapter + Assembly V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `3-adapter/android/adapter-android-v2` and `4-assembly/android/mixc-retail-assembly-rn84` so the old validated Android native / assembly split is preserved, old native capabilities are reused where sound, old configuration coverage is retained, and the old `LocalWebServer` is replaced by a native `topologyHost` aligned with `0-mock-server/dual-topology-host`.

**Architecture:** The work is split into two new packages. `adapter-android-v2` keeps `adapter-lib + dev-app`, reuses the proven native managers, and introduces a new embedded `topologyHost` native subsystem whose HTTP / WS behavior mirrors `dual-topology-host`. `mixc-retail-assembly-rn84` remains the RN 0.84 bare host, inherits the old dual-screen startup / restart architecture, exposes the adapter capabilities via TurboModules, assembles new `platformPorts`, and boots `createKernelRuntimeApp(...)` with the new `1-kernel` / `2-ui` runtime graph.

**Tech Stack:** Android Gradle Plugin, Kotlin, Java 17, AndroidX, RN 0.84.1 new architecture, Hermes, TurboModules / codegen, TypeScript, Metro, Babel, Reactotron, Vitest, Android instrumentation tests, loopback HTTP / WS protocol testing, `@next/kernel-base-runtime-shell-v2`, `@next/kernel-base-platform-ports`, `@next/kernel-base-topology-runtime-v2`, `@next/ui-integration-retail-shell`

---

## File Map

### New adapter package

- Create: `3-adapter/android/adapter-android-v2/package.json`
- Create: `3-adapter/android/adapter-android-v2/build.gradle`
- Create: `3-adapter/android/adapter-android-v2/settings.gradle`
- Create: `3-adapter/android/adapter-android-v2/gradle.properties`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/build.gradle`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/AndroidManifest.xml`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/next/adapterv2/**`
- Create: `3-adapter/android/adapter-android-v2/dev-app/build.gradle`
- Create: `3-adapter/android/adapter-android-v2/dev-app/src/main/AndroidManifest.xml`
- Create: `3-adapter/android/adapter-android-v2/dev-app/src/main/java/com/next/adapterv2/dev/**`
- Create: `3-adapter/android/adapter-android-v2/README.md`

### New assembly package

- Create: `4-assembly/android/mixc-retail-assembly-rn84/package.json`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/tsconfig.json`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/babel.config.js`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/metro.config.js`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/index.js`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/App.tsx`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/**`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/**`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/turbomodules/**`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/types/**`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/android/build.gradle`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/android/settings.gradle`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/android/gradle.properties`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/android/app/build.gradle`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/AndroidManifest.xml`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/next/mixcretailassemblyrn84/**`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/assets/**`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/README.md`

### Root workspace wiring

- Modify: `package.json`
  - add package scripts for the two new packages
- Modify: `scripts/**` only if the new packages need release/version integration hooks

### Read-only references that guide implementation

- Read-only reference: `_old_/3-adapter/android/adapterPure/**`
- Read-only reference: `_old_/4-assembly/android/mixc-retail-rn84v2/**`
- Read-only reference: `0-mock-server/dual-topology-host/**`
- Read-only reference: `1-kernel/1.1-base/platform-ports/src/types/ports.ts`
- Read-only reference: `1-kernel/1.1-base/runtime-shell-v2/src/application/createKernelRuntimeApp.ts`
- Read-only reference: `2-ui/2.3-integration/retail-shell/src/application/createModule.ts`

---

## Task 1: Wire the monorepo for the new Android packages

**Files:**
- Modify: `package.json`
- Test: `package.json`

- [ ] **Step 1: Add root scripts for the new adapter package**

Add workspace scripts alongside the existing `adapterPure` scripts:

```json
{
  "scripts": {
    "adapter:android-v2:build": "corepack yarn workspace @next/adapter-android-v2 build:android",
    "adapter:android-v2:all": "corepack yarn workspace @next/adapter-android-v2 android:all"
  }
}
```

- [ ] **Step 2: Add root scripts for the new assembly package**

Add workspace scripts alongside the old RN84 assembly scripts:

```json
{
  "scripts": {
    "assembly:android-mixc-retail-rn84:metro": "corepack yarn workspace @next/assembly-android-mixc-retail-rn84 start:clean",
    "assembly:android-mixc-retail-rn84:run": "corepack yarn workspace @next/assembly-android-mixc-retail-rn84 android:run"
  }
}
```

- [ ] **Step 3: Verify Yarn workspace discovery**

Run: `corepack yarn workspaces list | rg 'adapter-android-v2|assembly-android-mixc-retail-rn84'`

Expected: the new workspaces are listed after package creation.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "Prepare workspace scripts for Android adapter and assembly v2"
```

---

## Task 2: Scaffold `adapter-android-v2` by inheriting the proven `adapterPure` structure

**Files:**
- Create: `3-adapter/android/adapter-android-v2/package.json`
- Create: `3-adapter/android/adapter-android-v2/build.gradle`
- Create: `3-adapter/android/adapter-android-v2/settings.gradle`
- Create: `3-adapter/android/adapter-android-v2/gradle.properties`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/build.gradle`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/AndroidManifest.xml`
- Create: `3-adapter/android/adapter-android-v2/dev-app/build.gradle`
- Create: `3-adapter/android/adapter-android-v2/dev-app/src/main/AndroidManifest.xml`
- Create: `3-adapter/android/adapter-android-v2/README.md`
- Test: `3-adapter/android/adapter-android-v2/package.json`

- [ ] **Step 1: Copy the root Gradle shape from `adapterPure`**

Use the old package as the direct template for:

1. `build.gradle`
2. `settings.gradle`
3. `gradle.properties`

Keep the proven values unless a later task intentionally changes them:

```groovy
buildscript {
  ext {
    kotlinVersion = '2.0.21'
    agpVersion = '8.8.2'
    minSdkVersion = 24
    targetSdkVersion = 35
    compileSdkVersion = 35
  }
}
```

```properties
org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m
android.useAndroidX=true
android.enableJetifier=true
kotlin.code.style=official
```

- [ ] **Step 2: Create the adapter workspace package metadata**

Create `package.json` with the same usage model as `adapterPure`, but rename the workspace and keep the same command shape:

```json
{
  "name": "@next/adapter-android-v2",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "android:dev": "zsh -lc 'source ~/.zshrc >/dev/null 2>&1 || true; if ! command -v adb >/dev/null 2>&1; then echo adb not found in PATH after loading ~/.zshrc; exit 1; fi; if ! adb devices | grep -qE \"(^|[[:space:]])device$\"; then echo no connected Android device or emulator found; exit 1; fi; cd dev-app && ../gradlew :dev-app:installDebug'",
    "build:android": "zsh -lc 'source ~/.zshrc >/dev/null 2>&1 || true; cd . && ./gradlew :adapter-lib:assembleDebug :dev-app:assembleDebug'",
    "android:start": "zsh -lc 'source ~/.zshrc >/dev/null 2>&1 || true; if ! command -v adb >/dev/null 2>&1; then echo adb not found in PATH after loading ~/.zshrc; exit 1; fi; if ! adb devices | grep -qE \"(^|[[:space:]])device$\"; then echo no connected Android device or emulator found; exit 1; fi; adb shell am start -n com.next.adapterv2.dev/.MainActivity'",
    "android:all": "zsh -lc 'source ~/.zshrc >/dev/null 2>&1 || true; if ! command -v adb >/dev/null 2>&1; then echo adb not found in PATH after loading ~/.zshrc; exit 1; fi; if ! adb devices | grep -qE \"(^|[[:space:]])device$\"; then echo no connected Android device or emulator found; exit 1; fi; cd . && ./gradlew :adapter-lib:assembleDebug :dev-app:installDebug && adb shell am start -n com.next.adapterv2.dev/.MainActivity'"
  }
}
```

- [ ] **Step 3: Create `adapter-lib` with inherited manifest and build configuration**

Model `adapter-lib/build.gradle` after the old package and keep the same proven compatibility envelope:

```groovy
apply plugin: 'com.android.library'
apply plugin: 'org.jetbrains.kotlin.android'

android {
  namespace 'com.next.adapterv2'
  compileSdk rootProject.ext.compileSdkVersion

  defaultConfig {
    minSdk rootProject.ext.minSdkVersion
    consumerProguardFiles 'consumer-rules.pro'
  }

  compileOptions {
    sourceCompatibility JavaVersion.VERSION_17
    targetCompatibility JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = '17'
  }
}
```

The initial manifest must keep the baseline service / activity permissions from the old adapter:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.CAMERA" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
</manifest>
```

- [ ] **Step 4: Create `dev-app` with inherited standalone test-shell behavior**

Model `dev-app/build.gradle` and `AndroidManifest.xml` after `adapterPure/dev-app`, updating only identifiers:

```groovy
android {
  namespace 'com.next.adapterv2.dev'
  defaultConfig {
    applicationId 'com.next.adapterv2.dev'
    minSdk rootProject.ext.minSdkVersion
    targetSdk rootProject.ext.targetSdkVersion
    versionCode 1
    versionName '1.0'
  }
}
```

```xml
<application
  android:allowBackup="true"
  android:label="Adapter Android V2 Dev"
  android:supportsRtl="true"
  android:usesCleartextTraffic="true"
  android:theme="@style/Theme.Material3.DayNight.NoActionBar">
  <activity
    android:name=".MainActivity"
    android:exported="true">
    <intent-filter>
      <action android:name="android.intent.action.MAIN" />
      <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>
  </activity>
</application>
```

- [ ] **Step 5: Verify the package compiles structurally**

Run: `cd 3-adapter/android/adapter-android-v2 && ./gradlew :adapter-lib:compileDebugKotlin :dev-app:assembleDebug`

Expected: Gradle configuration succeeds even if native features are still placeholder stubs.

- [ ] **Step 6: Commit**

```bash
git add 3-adapter/android/adapter-android-v2
git commit -m "Scaffold the Android adapter v2 package with inherited native project structure"
```

---

## Task 3: Reuse the sound native managers from `adapterPure`

**Files:**
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/next/adapterv2/device/**`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/next/adapterv2/connector/**`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/next/adapterv2/logger/**`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/next/adapterv2/scripts/**`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/next/adapterv2/appcontrol/**`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/next/adapterv2/camera/**`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/next/adapterv2/interfaces/**`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/next/adapterv2/errors/**`
- Test: `3-adapter/android/adapter-android-v2/adapter-lib/**`

- [ ] **Step 1: Port the old interfaces and models into the new namespace**

Copy the old interface structure first, preserving shape and comments where they are still correct:

1. `IDeviceManager`
2. `IConnector`
3. `ILogManager`
4. `IScriptEngine`
5. `IStateStorage`
6. model classes in `interfaces`

Change only:

1. package name from `com.next.adapter` to `com.next.adapterv2`
2. references that still mention the old `LocalWebServer`

- [ ] **Step 2: Port the sound native managers with minimal behavior changes**

Copy the proven implementations into the new namespace first:

1. `DeviceManager`
2. `ConnectorManager`
3. `LogManager`
4. `ScriptEngineManager`
5. `AppControlManager`
6. camera support classes

At this stage, preserve behavior instead of redesigning it.

- [ ] **Step 3: Replace any old `LocalWebServer` references with temporary `topologyHost` placeholders**

If any copied code still references the old webserver models, replace them with explicit placeholders so the new package does not continue pretending the old protocol is valid:

```kotlin
// Temporary placeholder until Task 4 ports the new topologyHost.
```

- [ ] **Step 4: Run native compilation against the copied managers**

Run: `cd 3-adapter/android/adapter-android-v2 && ./gradlew :adapter-lib:compileDebugKotlin`

Expected: the reused manager areas compile under the new namespace.

- [ ] **Step 5: Commit**

```bash
git add 3-adapter/android/adapter-android-v2/adapter-lib
git commit -m "Reuse the proven Android native managers in adapter v2"
```

---

## Task 4: Build the new native `topologyHost` aligned with `dual-topology-host`

**Files:**
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/next/adapterv2/topologyhost/TopologyHostManager.kt`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/next/adapterv2/topologyhost/TopologyHostService.kt`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/next/adapterv2/topologyhost/TopologyHostServer.kt`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/next/adapterv2/topologyhost/TopologyHostConfig.kt`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/next/adapterv2/topologyhost/TopologyHostStats.kt`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/next/adapterv2/topologyhost/http/**`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/next/adapterv2/topologyhost/ws/**`
- Create: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/java/com/next/adapterv2/topologyhost/runtime/**`
- Modify: `3-adapter/android/adapter-android-v2/adapter-lib/src/main/AndroidManifest.xml`
- Test: `3-adapter/android/adapter-android-v2/adapter-lib/src/**`

- [ ] **Step 1: Define config / status / stats models from the mock host contract**

Mirror the service surface from `0-mock-server/dual-topology-host/src/types/server.ts`.

Define Kotlin models that cover:

1. port
2. basePath
3. heartbeatIntervalMs
4. heartbeatTimeoutMs
5. defaultTicketExpiresInMs
6. host address info
7. host stats
8. fault-rule replace request / response

- [ ] **Step 2: Port the lifecycle shell from the old `LocalWebServer` pattern**

Reuse the old Android host shell ideas:

1. manager facade,
2. foreground service,
3. service binding,
4. start / stop / status synchronization,
5. diagnostics snapshot,
6. timer / executor management.

But rename everything to `TopologyHost*`.

- [ ] **Step 3: Implement the HTTP route surface to match `dual-topology-host`**

The server must expose:

1. `GET {basePath}/health`
2. `GET {basePath}/stats`
3. `POST {basePath}/tickets`
4. `PUT {basePath}/fault-rules`

Match the response semantics from the Node implementation first.

- [ ] **Step 4: Implement the WebSocket route and message handling**

The server must expose:

1. `WS {basePath}/ws`

And support these message categories:

1. `__host_heartbeat`
2. `__host_heartbeat_ack`
3. `node-hello`
4. `node-hello-ack`
5. `resume-begin`
6. `resume-complete`
7. `command-dispatch`
8. `command-event`
9. `projection-mirror`
10. `request-lifecycle-snapshot`
11. `state-sync-summary`
12. `state-sync-diff`
13. `state-sync-commit-ack`

- [ ] **Step 5: Port the host runtime semantics from the Node mock host**

Recreate the observable contract:

1. ticket issuance
2. session tracking
3. hello processing
4. heartbeat expiry
5. queued relay while offline
6. resume begin / complete
7. fault rule replacement
8. outbox flushing

Do not shortcut this through Android-only private behavior.

- [ ] **Step 6: Register the new service in the library manifest**

Replace the old webserver service entry with a topology host service entry:

```xml
<service
  android:name=".topologyhost.TopologyHostService"
  android:enabled="true"
  android:exported="false"
  android:foregroundServiceType="dataSync" />
```

- [ ] **Step 7: Add native verification tests for topology host parity**

Create tests that prove:

1. `/health` responds
2. `/stats` responds
3. `/tickets` returns a ticket
4. `/fault-rules` updates rules
5. WS hello / ack works
6. queued dispatch does not flush until resume complete

- [ ] **Step 8: Run native tests**

Run: `cd 3-adapter/android/adapter-android-v2 && ./gradlew :adapter-lib:testDebugUnitTest :adapter-lib:connectedDebugAndroidTest`

Expected: the new topology host service and protocol tests pass.

- [ ] **Step 9: Commit**

```bash
git add 3-adapter/android/adapter-android-v2/adapter-lib
git commit -m "Replace the old local web server with a native topology host aligned to the mock host"
```

---

## Task 5: Turn `dev-app` into a native diagnostics and topology-host verification shell

**Files:**
- Create: `3-adapter/android/adapter-android-v2/dev-app/src/main/java/com/next/adapterv2/dev/MainActivity.kt`
- Create: `3-adapter/android/adapter-android-v2/dev-app/src/main/java/com/next/adapterv2/dev/ui/**`
- Test: `3-adapter/android/adapter-android-v2/dev-app/**`

- [ ] **Step 1: Port the old diagnostics shell structure**

Reuse the working structure from `adapterPure/dev-app`:

1. home
2. console session store
3. test fragments / screens

Rename packages and labels to `adapterv2`.

- [ ] **Step 2: Replace the old local web server test screen with topology host diagnostics**

Create a dedicated diagnostics screen that can:

1. start host
2. stop host
3. show health / status / stats
4. create tickets
5. replace fault rules
6. show recent host events

- [ ] **Step 3: Add visible automation hooks**

The dev app UI must expose stable test nodes or labels so automation can validate:

1. capability tabs render
2. topology host can be started
3. ticket creation succeeds
4. stop returns to stopped state

- [ ] **Step 4: Run the dev-app build and install flow**

Run: `cd 3-adapter/android/adapter-android-v2 && ./gradlew :dev-app:assembleDebug`

Expected: the dev app builds successfully with the new topology host diagnostics screen.

- [ ] **Step 5: Commit**

```bash
git add 3-adapter/android/adapter-android-v2/dev-app
git commit -m "Turn the adapter v2 dev app into a topology host and native capability diagnostics shell"
```

---

## Task 6: Scaffold `mixc-retail-assembly-rn84` by inheriting the proven RN84 app shell

**Files:**
- Create: `4-assembly/android/mixc-retail-assembly-rn84/package.json`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/tsconfig.json`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/babel.config.js`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/metro.config.js`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/index.js`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/App.tsx`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/android/build.gradle`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/android/settings.gradle`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/android/gradle.properties`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/android/app/build.gradle`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/AndroidManifest.xml`
- Test: `4-assembly/android/mixc-retail-assembly-rn84/**`

- [ ] **Step 1: Copy the RN 0.84 package shell from the old assembly**

Start from the old successful shape:

1. `package.json`
2. `tsconfig.json`
3. `babel.config.js`
4. `metro.config.js`
5. `index.js`
6. Android Gradle files

Rename only package identifiers and workspace names first.

- [ ] **Step 2: Keep the old new-architecture settings**

Preserve these values unless implementation proves a real incompatibility:

```properties
newArchEnabled=true
hermesEnabled=true
reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
```

- [ ] **Step 3: Point the Android app to the new adapter source**

Set `android/settings.gradle` to reference the new adapter library source:

```gradle
include ':adapter-android-v2'
project(':adapter-android-v2').projectDir = file('../../../../3-adapter/android/adapter-android-v2/adapter-lib')
```

- [ ] **Step 4: Keep the old dual-activity manifest shape**

The manifest must preserve:

1. `MainActivity`
2. `SecondaryActivity`
3. `android:process=":secondary"`
4. `usesCleartextTraffic`
5. `networkSecurityConfig`
6. `largeHeap`
7. startup theme split

- [ ] **Step 5: Verify the Android app shell configures cleanly**

Run: `cd 4-assembly/android/mixc-retail-assembly-rn84/android && ./gradlew :app:tasks`

Expected: the RN app project configures successfully and sees the new adapter library dependency.

- [ ] **Step 6: Commit**

```bash
git add 4-assembly/android/mixc-retail-assembly-rn84
git commit -m "Scaffold the RN84 Android assembly v2 package from the proven host shell"
```

---

## Task 7: Rebuild the native assembly startup / restart / dual-screen host

**Files:**
- Create: `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/next/mixcretailassemblyrn84/MainApplication.kt`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/next/mixcretailassemblyrn84/MainActivity.kt`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/next/mixcretailassemblyrn84/SecondaryActivity.kt`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/next/mixcretailassemblyrn84/startup/**`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/next/mixcretailassemblyrn84/restart/**`
- Test: `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/**`

- [ ] **Step 1: Port the old startup coordinator chain**

Reuse and adapt the proven native classes:

1. `StartupCoordinator`
2. `SecondaryDisplayLauncher`
3. `SecondaryProcessController`
4. `LaunchOptionsFactory`
5. `StartupOverlayManager`
6. `StartupAuditLogger`

Preserve the old operational intent:

1. primary ready drives the next phase
2. overlay hide is delayed
3. secondary launch is delayed
4. restart resets orchestration state

- [ ] **Step 2: Port the controlled restart chain**

Preserve the old restart discipline:

1. record audit log
2. stop embedded topology host if running
3. request secondary shutdown
4. wait for ACK or timeout
5. reload main runtime
6. re-launch secondary after main ready

- [ ] **Step 3: Add assembly-native tests for startup behavior**

Create tests or instrumentation checks that validate:

1. primary attach shows overlay
2. primary ready schedules overlay hide
3. primary ready schedules secondary launch
4. restart clears pending callbacks

- [ ] **Step 4: Run native assembly verification**

Run: `cd 4-assembly/android/mixc-retail-assembly-rn84/android && ./gradlew :app:assembleDebug`

Expected: the app builds with the new startup and restart classes.

- [ ] **Step 5: Commit**

```bash
git add 4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java
git commit -m "Rebuild the Android assembly startup and dual-screen orchestration on the proven native model"
```

---

## Task 8: Expose adapter capabilities through TurboModules and TS wrappers

**Files:**
- Create: `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/next/mixcretailassemblyrn84/turbomodules/AdapterPackage.kt`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/android/app/src/main/java/com/next/mixcretailassemblyrn84/turbomodules/*TurboModule.kt`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/turbomodules/*.ts`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/platform-ports/*.ts`
- Test: `4-assembly/android/mixc-retail-assembly-rn84/src/**`

- [ ] **Step 1: Port the old TurboModule registry pattern**

Create `AdapterPackage.kt` by inheriting the old successful `BaseReactPackage` structure.

Register modules for:

1. device
2. logger
3. scripts
4. connector
5. topology host
6. app control

- [ ] **Step 2: Replace `LocalWebServerTurboModule` with `TopologyHostTurboModule`**

Do not carry forward the old module name.

Instead, create a new module whose public surface covers:

1. `startTopologyHost`
2. `stopTopologyHost`
3. `getTopologyHostStatus`
4. `getTopologyHostStats`
5. `replaceTopologyHostFaultRules`

- [ ] **Step 3: Create TS TurboModule specs and wrappers**

Create one TS spec per native capability and keep the shape close to the old assembly where practical.

Create wrapper helpers in `src/platform-ports/` that adapt those native modules to the new `PlatformPorts` interfaces:

1. `logger`
2. `device`
3. `scriptExecutor`
4. `connector`
5. `appControl`
6. optional `stateStorage`

`topologyHost` is not a standard `PlatformPorts` capability by default.
It should be injected through assembly/bootstrap support code, not forced into kernel base if the kernel does not require a first-class port for it.

- [ ] **Step 4: Run JS typecheck and codegen configuration validation**

Run:

1. `cd 4-assembly/android/mixc-retail-assembly-rn84 && corepack yarn type-check`
2. `cd 4-assembly/android/mixc-retail-assembly-rn84/android && ./gradlew :app:generateCodegenArtifactsFromSchema`

Expected: TS types resolve and RN codegen completes.

- [ ] **Step 5: Commit**

```bash
git add 4-assembly/android/mixc-retail-assembly-rn84
git commit -m "Expose adapter v2 capabilities through TurboModules and TS platform port wrappers"
```

---

## Task 9: Rebuild the assembly JS runtime bootstrap on `createKernelRuntimeApp(...)`

**Files:**
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/createApp.ts`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/createRuntime.ts`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/resolveLaunchProps.ts`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/configureDevtools.ts`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/index.ts`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/types/shared/appProps.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/App.tsx`
- Test: `4-assembly/android/mixc-retail-assembly-rn84/src/application/**`

- [ ] **Step 1: Port the old launch props shape**

Create `AppProps` using the same bootstrap fields that already work in the old assembly:

```ts
export interface AppProps {
  deviceId: string
  screenMode: string
  displayCount: number
  displayIndex: number
  isEmulator: boolean
}
```

- [ ] **Step 2: Build a clear runtime bootstrap**

Create `createRuntime.ts` that:

1. resolves launch props,
2. creates `platformPorts`,
3. configures Reactotron in DEV,
4. installs the new runtime module list,
5. creates `createKernelRuntimeApp(...)`,
6. starts the runtime.

- [ ] **Step 3: Install the new runtime graph**

The module list should include the actual rebuilt runtime modules needed by the app, for example:

1. kernel base topology / state / tcp / workflow modules required by the shell
2. `@next/ui-base-runtime-react`
3. `@next/ui-base-input-runtime`
4. `@next/ui-base-admin-console`
5. `@next/ui-base-terminal-console`
6. `@next/ui-integration-retail-shell`

Do not create a fake old-style assembly module just to register things globally.

- [ ] **Step 4: Make `App.tsx` a thin host root**

`App.tsx` should:

1. create the app once,
2. await runtime startup,
3. render the root shell,
4. stay thin and readable.

- [ ] **Step 5: Add bootstrap tests**

Create tests that verify:

1. launch props are parsed correctly,
2. Reactotron naming uses `displayIndex + deviceId`,
3. runtime app creation receives the expected display context,
4. the module graph boots without recreating old `ApplicationManager` patterns.

- [ ] **Step 6: Run JS tests**

Run: `cd 4-assembly/android/mixc-retail-assembly-rn84 && corepack yarn test`

Expected: bootstrap and runtime creation tests pass.

- [ ] **Step 7: Commit**

```bash
git add 4-assembly/android/mixc-retail-assembly-rn84/src 4-assembly/android/mixc-retail-assembly-rn84/App.tsx
git commit -m "Rebuild the RN84 assembly bootstrap around createKernelRuntimeApp"
```

---

## Task 10: Reintroduce Reactotron and DEV visibility correctly

**Files:**
- Create: `4-assembly/android/mixc-retail-assembly-rn84/src/application/configureDevtools.ts`
- Modify: `4-assembly/android/mixc-retail-assembly-rn84/package.json`
- Test: `4-assembly/android/mixc-retail-assembly-rn84/src/application/configureDevtools.ts`

- [ ] **Step 1: Port the old Reactotron host configuration**

Keep the package-level config shape:

```json
{
  "reactotron": {
    "emulatorHost": "localhost",
    "deviceHost": "192.168.0.172"
  }
}
```

- [ ] **Step 2: Port the old client naming rule**

Use the same naming discipline:

1. primary display -> `Main`
2. secondary display -> `Secondary-${displayIndex}`
3. include `deviceId`

- [ ] **Step 3: Add tests for host and client name derivation**

Run: `cd 4-assembly/android/mixc-retail-assembly-rn84 && corepack yarn vitest run src/application/configureDevtools.test.ts`

Expected: host resolution and client naming logic are covered.

- [ ] **Step 4: Commit**

```bash
git add 4-assembly/android/mixc-retail-assembly-rn84/package.json 4-assembly/android/mixc-retail-assembly-rn84/src/application
git commit -m "Restore Reactotron DEV behavior for the new RN84 assembly"
```

---

## Task 11: Verify real topology/runtime behavior across primary and secondary runtimes

**Files:**
- Create: `4-assembly/android/mixc-retail-assembly-rn84/test/**`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/test-automation/**` if needed
- Test: `4-assembly/android/mixc-retail-assembly-rn84/**`

- [ ] **Step 1: Add assembly-side integration tests that exercise the embedded topology host**

Create tests that verify:

1. the embedded host can be started from native or bridge APIs,
2. the primary runtime can obtain a pairing ticket,
3. the primary runtime can connect over real WS,
4. the secondary runtime can connect over real WS,
5. remote dispatch and resume semantics work across both runtimes.

- [ ] **Step 2: Add dual-screen instrumentation hooks**

Create test helpers that can:

1. observe the primary activity,
2. detect secondary activity startup,
3. observe startup overlay transitions,
4. verify restart rebuild behavior.

- [ ] **Step 3: Add UI automation coverage**

Automate at least:

1. app launch
2. dual-screen startup
3. retail shell renders on primary
4. retail shell renders on secondary
5. admin trigger can be opened in DEV

- [ ] **Step 4: Run real end-to-end verification**

Run these verification commands in sequence:

1. `cd 3-adapter/android/adapter-android-v2 && ./gradlew :adapter-lib:testDebugUnitTest :dev-app:assembleDebug`
2. `cd 4-assembly/android/mixc-retail-assembly-rn84 && corepack yarn type-check`
3. `cd 4-assembly/android/mixc-retail-assembly-rn84/android && ./gradlew :app:assembleDebug`
4. install and launch on a real device / emulator pair where dual-screen behavior can be observed

Expected: primary and secondary startup, topology connectivity, and runtime shell rendering all complete successfully.

- [ ] **Step 5: Commit**

```bash
git add 4-assembly/android/mixc-retail-assembly-rn84/test 4-assembly/android/mixc-retail-assembly-rn84/android
git commit -m "Verify the Android assembly v2 against real topology and dual-screen runtime behavior"
```

---

## Task 12: Write package READMEs and operation notes

**Files:**
- Create: `3-adapter/android/adapter-android-v2/README.md`
- Create: `4-assembly/android/mixc-retail-assembly-rn84/README.md`
- Test: `README.md`

- [ ] **Step 1: Document adapter package intent clearly**

The adapter README must explain:

1. pure Android positioning,
2. reusable native capability scope,
3. `topologyHost` replacing old `LocalWebServer`,
4. `dev-app` purpose,
5. build / run / test commands.

- [ ] **Step 2: Document assembly package intent clearly**

The assembly README must explain:

1. RN bare host positioning,
2. relationship to `adapter-android-v2`,
3. dual-process / dual-display model,
4. TurboModule ownership,
5. runtime bootstrap around `createKernelRuntimeApp(...)`,
6. Reactotron and test commands.

- [ ] **Step 3: Run a final doc sanity pass**

Run: `rg -n "LocalWebServer" 3-adapter/android/adapter-android-v2 4-assembly/android/mixc-retail-assembly-rn84`

Expected: only historical comparison text remains where intentional; no new code or public API should still be pretending the new host is the old protocol.

- [ ] **Step 4: Commit**

```bash
git add 3-adapter/android/adapter-android-v2/README.md 4-assembly/android/mixc-retail-assembly-rn84/README.md
git commit -m "Document the Android adapter and assembly v2 package boundaries and operations"
```

---

## Self-Review

### Spec coverage

This plan covers the spec requirements:

1. preserve the old adapter / assembly split,
2. keep `adapter-lib + dev-app`,
3. keep RN 0.84 bare assembly,
4. reuse sound native managers,
5. inherit old configuration surface,
6. replace old `LocalWebServer` with native `topologyHost`,
7. align `topologyHost` to `dual-topology-host`,
8. rebuild assembly bootstrap on the new base runtime,
9. preserve dual-screen startup / restart,
10. restore Reactotron,
11. provide native and assembly automation.

### Placeholder scan

No `TODO`, `TBD`, or “implement later” placeholders are intentionally left in the task steps.

### Type consistency

The plan consistently uses:

1. `adapter-android-v2`
2. `mixc-retail-assembly-rn84`
3. `topologyHost`
4. `TopologyHostTurboModule`

and avoids reintroducing the old `LocalWebServer` name except when explicitly describing the legacy source.
