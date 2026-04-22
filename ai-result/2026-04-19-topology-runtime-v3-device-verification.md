# Topology Runtime V3 Device Verification

- Date: 2026-04-19
- Workspace: `newPOSv1`
- Verification mode: Android automation socket over ADB

## Attached Devices

```text
List of devices attached
emulator-5554          device product:sdk_gtablet_arm64 model:Pixel_Tablet device:emu64a transport_id:1
```

结论：当前只连接了模拟器 `emulator-5554`，没有物理真机，因此“真机验证 gate”仍未满足。

## Smoke

### Primary
```json
{
  "serial": "emulator-5554",
  "target": "primary",
  "hostPort": 18584,
  "devicePort": 18584,
  "hello": {
    "jsonrpc": "2.0",
    "result": {
      "protocolVersion": 1,
      "capabilities": [
        "runtime.query",
        "ui.semanticRegistry",
        "wait",
        "trace",
        "scripts.execute"
      ],
      "availableTargets": [
        "host",
        "primary"
      ],
      "buildProfile": "debug",
      "productMode": false,
      "scriptExecutionAvailable": true
    }
  },
  "info": {
    "jsonrpc": "2.0",
    "result": {
      "protocolVersion": 1,
      "runtimeId": "run_mo5a8si8_o0jpiv9c8p8lwtf9",
      "localNodeId": "master:J9RZPWR3HK",
      "environmentMode": "DEV",
      "displayContext": {
        "displayIndex": 0,
        "displayCount": 2
      },
      "currentScreen": {
        "containerKey": "primary.root.container",
        "screen": {
          "partKey": "ui.base.terminal.activate-device",
          "rendererKey": "ui.base.terminal.activate-device",
          "props": null
        },
        "overlayCount": 0
      }
    }
  },
  "treeNodeCount": 48,
  "idle": {
    "jsonrpc": "2.0",
    "result": {
      "ok": true
    }
  }
}
```

### Secondary
```json
{
  "serial": "emulator-5554",
  "target": "secondary",
  "hostPort": 18585,
  "devicePort": 18585,
  "hello": {
    "jsonrpc": "2.0",
    "result": {
      "protocolVersion": 1,
      "capabilities": [
        "runtime.query",
        "ui.semanticRegistry",
        "wait",
        "trace",
        "scripts.execute"
      ],
      "availableTargets": [
        "host",
        "secondary"
      ],
      "buildProfile": "debug",
      "productMode": false,
      "scriptExecutionAvailable": true
    }
  },
  "info": {
    "jsonrpc": "2.0",
    "result": {
      "protocolVersion": 1,
      "runtimeId": "run_mo5a8sh5_4bo1ol9yhfzp93j8",
      "localNodeId": "master:J9RZPWR3HK:display-1",
      "environmentMode": "DEV",
      "displayContext": {
        "displayIndex": 1,
        "displayCount": 2
      },
      "currentScreen": {
        "containerKey": "secondary.root.container",
        "screen": {
          "partKey": "ui.base.terminal.activate-device-secondary",
          "rendererKey": "ui.base.terminal.activate-device-secondary",
          "props": null
        },
        "overlayCount": 0
      }
    }
  },
  "treeNodeCount": 10,
  "idle": {
    "jsonrpc": "2.0",
    "result": {
      "ok": true
    }
  }
}
```

## Topology Context

### Primary context
```json
{
  "displayIndex": 0,
  "displayCount": 2,
  "instanceMode": "MASTER",
  "displayMode": "PRIMARY",
  "workspace": "MAIN",
  "standalone": true,
  "enableSlave": true,
  "localNodeId": "master:J9RZPWR3HK"
}
```

### Secondary context
```json
{
  "displayIndex": 1,
  "displayCount": 2,
  "instanceMode": "SLAVE",
  "displayMode": "SECONDARY",
  "workspace": "MAIN",
  "standalone": false,
  "enableSlave": false,
  "masterLocator": {
    "masterNodeId": "master:J9RZPWR3HK",
    "masterDeviceId": "J9RZPWR3HK",
    "serverAddress": [
      {
        "address": "ws://127.0.0.1:8888/mockMasterServer/ws"
      }
    ],
    "httpBaseUrl": "http://127.0.0.1:8888/mockMasterServer",
    "addedAt": 1776578765682
  },
  "localNodeId": "master:J9RZPWR3HK:display-1"
}
```

## Demo Sync Before Activation

### Master -> Slave
```json
{
  "commandName": "kernel.base.topology-runtime-v3.upsert-demo-master-entry",
  "status": "COMPLETED"
}
{
  "socket-evidence-master": {
    "value": {
      "label": "socket-evidence-master",
      "phase": "PRE_ACTIVATION",
      "note": "master-to-slave evidence",
      "updatedBy": "MASTER"
    }
  }
}
```

### Slave -> Master
```json
{
  "commandName": "kernel.base.topology-runtime-v3.upsert-demo-slave-entry",
  "status": "COMPLETED"
}
{
  "socket-evidence-slave": {
    "value": {
      "label": "socket-evidence-slave",
      "phase": "PRE_ACTIVATION",
      "note": "slave-to-master evidence",
      "updatedBy": "SLAVE"
    }
  }
}
```

## Activation Flow

- Mock platform activation code prepared from `1-kernel/server-config-v2`: `087837750895`

### Activation result
```json
{
  "activation": {
    "activationStatus": "ACTIVATED",
    "terminalId": "terminal_hy993m9ihbkh",
    "sandboxId": "sandbox-kernel-base-test"
  }
}
```

### Post-activation identity
```json
{
  "primary": {
    "activationStatus": "ACTIVATED",
    "terminalId": "terminal_hy993m9ihbkh"
  },
  "secondary": {
    "activationStatus": "ACTIVATED",
    "terminalId": "terminal_hy993m9ihbkh"
  }
}
```

### Post-activation current screens
```json
{
  "primary": "ui.integration.retail-shell.welcome",
  "secondary": "ui.integration.retail-shell.secondary-welcome"
}
```

### Post-activation semantic UI evidence
```json
{
  "primaryTerminalNode": {
    "nodeId": "ui-integration-retail-shell:welcome:terminal-id",
    "value": "terminal_hy993m9ihbkh"
  },
  "secondaryTerminalNode": {
    "nodeId": "ui-integration-retail-shell:secondary-welcome:terminal-id",
    "value": "terminal_hy993m9ihbkh"
  }
}
```

### Demo sync while activated
```json
{
  "secondaryDemoMaster": {
    "activated-master": {
      "value": {
        "label": "activated-live",
        "phase": "ACTIVATED",
        "note": "post activation sync",
        "updatedBy": "MASTER"
      }
    }
  },
  "primaryDemoSlave": {
    "activated-slave": {
      "value": {
        "label": "activated-secondary",
        "phase": "ACTIVATED",
        "note": "reverse post activation sync",
        "updatedBy": "SLAVE"
      }
    }
  }
}
```

## Deactivation Flow

### Deactivation result
```json
{
  "screen": {
    "partKey": "ui.base.terminal.activate-device"
  },
  "message": {
    "nodeId": "ui-base-terminal-activate-device:message",
    "value": "master-unactivated"
  }
}
```

### Post-deactivation identity
```json
{
  "primary": {
    "activationStatus": "UNACTIVATED"
  },
  "secondary": {
    "activationStatus": "UNACTIVATED"
  }
}
```

### Post-deactivation current screens
```json
{
  "primary": "ui.base.terminal.activate-device",
  "secondary": "ui.base.terminal.activate-device-secondary"
}
```

### Post-deactivation semantic UI evidence
```json
{
  "primaryMessageNode": {
    "nodeId": "ui-base-terminal-activate-device:message",
    "text": "请向管理员索取激活码。激活成功后，本机将自动进入业务欢迎页。",
    "value": "master-unactivated"
  },
  "secondaryScreenNode": {
    "nodeId": "ui-base-terminal-activate-device-secondary",
    "text": "等待主屏完成设备激活"
  },
  "secondaryDeviceNode": {
    "nodeId": "ui-base-terminal-activate-device-secondary:device-id",
    "value": "J9RZPWR3HK"
  }
}
```

## Summary

- 模拟器双进程 `primary` / `secondary` socket 均可直接握手与查询。
- `topology-runtime-v3` 上下文符合设计：双屏主屏为 `MASTER + PRIMARY + standalone=true`，双屏副屏为 `SLAVE + SECONDARY + standalone=false`。
- V3 demo state 已证明双向同步：`master -> slave` 与 `slave -> master` 都能在 socket 直接读取到结果。
- 真实 mock-platform 激活链路已通过：激活后主副屏 identity 同步为 `ACTIVATED`，并分别进入 welcome / secondary-welcome。
- 真实 mock-platform 注销链路已通过：注销后主副屏 identity 同步回 `UNACTIVATED`，并分别回到激活页 / 副屏等待页。
- 旧包删除 gate 中“真机验证”仍未满足，因为当前 `adb devices -l` 只显示模拟器，没有物理设备。
