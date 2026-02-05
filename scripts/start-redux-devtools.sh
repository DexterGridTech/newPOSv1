#!/bin/bash

# Redux DevTools 服务器启动脚本
# 用于在本地启动 Redux DevTools 服务器，供 React Native 应用连接

echo "🚀 启动 Redux DevTools 服务器..."
echo "📡 服务器地址: http://localhost:8000"
echo "📱 Android 模拟器需要配置端口转发:"
echo "   adb reverse tcp:8000 tcp:8000"
echo ""

# 启动 Redux DevTools 服务器
# --hostname: 监听地址
# --port: 监听端口
# --open: 自动打开浏览器
redux-devtools --hostname localhost --port 8000 --open
