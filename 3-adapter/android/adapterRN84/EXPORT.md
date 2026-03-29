# adapterRN84 TurboModule 导出说明

## 目录结构

```
3-adapter/android/adapterRN84/
├── android/
│   ├── app/                          # 开发调试用的 RN 应用
│   └── turbomodule-lib/              # 导出给集成层的 TurboModule 库
│       ├── build.gradle
│       ├── build/generated/source/codegen/  # Codegen 生成的 Spec
│       └── src/main/java/com/adapterrn84/turbomodules/
│           ├── AdapterPackage.kt
│           ├── DeviceTurboModule.kt
│           └── device/DeviceManager.kt
├── src/                              # TypeScript 导出
└── package.json                      # 包含 codegenConfig
```

## 集成层使用方式

### 1. 在集成层的 settings.gradle 中引入

```gradle
// 引入 adapterRN84 的 TurboModule 库
def adapterRN84TurboModuleDir = file("../../../../3-adapter/android/adapterRN84/android/turbomodule-lib")
include ':adapter-rn84-turbomodule'
project(':adapter-rn84-turbomodule').projectDir = adapterRN84TurboModuleDir
```

### 2. 在集成层的 app/build.gradle 中添加依赖

```gradle
dependencies {
    implementation project(':adapter-rn84-turbomodule')
}
```

### 3. 在 MainApplication 中注册（如果需要）

```kotlin
import com.adapterrn84.turbomodules.AdapterPackage

override fun getPackages(): List<ReactPackage> =
    PackageList(this).packages.apply {
        add(AdapterPackage())
    }
```

## 注意事项

1. **Codegen 生成的文件**：`turbomodule-lib/build/generated/source/codegen/` 中的文件是自动生成的，每次修改 JS Spec 后需要重新运行 Codegen
2. **依赖版本**：集成层必须使用 RN 0.84+ 和 React 19
3. **新架构**：必须开启 `newArchEnabled=true`
