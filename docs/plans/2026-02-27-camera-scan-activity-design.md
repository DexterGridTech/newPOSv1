# CameraScanActivity 设计文档

**日期**：2026-02-27
**模块**：`3-adapter/android/pos-adapter/android/turbomodule-lib`

## 背景

`readBarCodeFromCamera` TaskDefinition 通过 `IntentChannel + ResultBridgeActivity` 调起摄像头扫码。
原方案依赖 ZXing App（第三方，POS 设备不预装），需在适配层内嵌实现扫码 Activity。

## 技术选型

**CameraX + ML Kit Barcode Scanning**

- CameraX 管理相机生命周期与预览（封装 Camera2，API 简洁）
- ML Kit 做条码识别（支持全部主流码制，低光/磨损场景准确率优于 ZXing Core）
- APK 增量约 2-3MB

## 架构与数据流

```
readBarCodeFromCamera (externalCall)
  → IntentChannel { waitResult: true }
    → ResultBridgeActivity.startActivityForResult
      → CameraScanActivity (CameraX 预览 + ML Kit 识别)
        → 扫到码 → setResult(RESULT_OK, { SCAN_RESULT, SCAN_RESULT_FORMAT })
      → onActivityResult → sendBroadcast (setPackage)
    → IntentChannel receiver → promise.resolve
  → resultScript 提取 barcode / format
```

Intent Action：`com.impos2.posadapter.action.CAMERA_SCAN`

## 组件

| 文件 | 职责 |
|------|------|
| `CameraScanActivity.kt` | 相机绑定、ML Kit 分析、权限检查、结果返回 |
| `ScanOverlayView.kt` | 纯绘制：半透明遮罩 + 透明扫描框 + 四角标记 |
| `build.gradle` | 新增 CameraX + ML Kit 依赖 |
| `AndroidManifest.xml` | 注册 Activity + 声明 CAMERA 权限 |
| `readBarCodeFromCamera.ts` | 更新 action 为新 Intent Action |

## UI 规格（B 风格）

```
┌─────────────────────────────┐
│                             │
│   将条码/二维码对准扫描框      │  ← 白色提示文字，居中
│                             │
│   ┌──╗              ╔──┐   │
│   │                     │   │
│   │   ←── 扫描框 ──→   │   │  ← 透明区域，约 260dp 正方形
│   │  ─────────────────  │   │  ← 扫描线，白色，1.5s 循环上下
│   │                     │   │
│   └──╝              ╚──┘   │
│                             │
│         [ 取消 ]            │  ← 底部按钮
└─────────────────────────────┘
```

- 遮罩：`#80000000`，通过 `PorterDuff.Mode.CLEAR` 挖空扫描框区域
- 四角：白色 L 形，臂长 20dp，线宽 2dp
- 扫描线：白色横线 2dp，`ObjectAnimator` 驱动 `translationY`，1.5s 无限循环

## 扫码格式

通过 `SCAN_MODE` extra 传入，映射到 ML Kit 格式过滤：

| SCAN_MODE | ML Kit 格式 |
|-----------|------------|
| `ALL`（默认）| 所有格式 |
| `QR_CODE_MODE` | `FORMAT_QR_CODE` |
| `BARCODE_MODE` | EAN-13、EAN-8、Code128、Code39、UPC-A、UPC-E |

## 返回值

| 场景 | resultCode | extras |
|------|-----------|--------|
| 扫码成功 | `RESULT_OK` | `SCAN_RESULT`（字符串）、`SCAN_RESULT_FORMAT`（码制名） |
| 用户取消/返回 | `RESULT_CANCELED` | 无 |
| 相机权限未授权 | `RESULT_CANCELED` | `error=CAMERA_PERMISSION_DENIED` |
| 相机打开失败 | `RESULT_CANCELED` | `error=CAMERA_OPEN_FAILED` |

## 依赖

```groovy
// CameraX
implementation "androidx.camera:camera-core:1.3.4"
implementation "androidx.camera:camera-camera2:1.3.4"
implementation "androidx.camera:camera-lifecycle:1.3.4"
implementation "androidx.camera:camera-view:1.3.4"
// ML Kit
implementation "com.google.mlkit:barcode-scanning:17.3.0"
```

## 权限

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

权限策略：Activity 启动时检查，未授权直接 `RESULT_CANCELED`，不弹系统权限框（由宿主 App 负责申请）。
