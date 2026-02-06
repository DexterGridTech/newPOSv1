#!/bin/bash

# ============================================
# IMPos2 项目自动化安装脚本
# ============================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 检查 Node.js 版本
check_node() {
    print_header "检查 Node.js 环境"

    if ! command_exists node; then
        print_error "未检测到 Node.js，请先安装 Node.js 18.0.0 或更高版本"
        print_info "下载地址: https://nodejs.org/"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)

    if [ "$NODE_MAJOR" -lt 18 ]; then
        print_error "Node.js 版本过低 (当前: v$NODE_VERSION)，需要 >= 18.0.0"
        exit 1
    fi

    print_success "Node.js 版本: v$NODE_VERSION ✓"
}

# 启用 Corepack
enable_corepack() {
    print_header "配置 Corepack"

    if ! command_exists corepack; then
        print_warning "Corepack 未找到，尝试启用..."
        if command_exists npm; then
            npm install -g corepack || {
                print_error "Corepack 安装失败"
                exit 1
            }
        else
            print_error "npm 未找到，无法安装 corepack"
            exit 1
        fi
    fi

    corepack enable || {
        print_warning "Corepack 启用失败，尝试使用 sudo..."
        sudo corepack enable || {
            print_error "Corepack 启用失败"
            exit 1
        }
    }

    print_success "Corepack 已启用 ✓"
}

# 检查 Java 环境
check_java() {
    print_header "检查 Java 环境"

    if ! command_exists java; then
        print_warning "未检测到 Java，Android 开发需要 JDK 17+"
        print_info "下载地址: https://adoptium.net/"
        return
    fi

    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)

    if [ "$JAVA_VERSION" -lt 17 ]; then
        print_warning "Java 版本过低 (当前: $JAVA_VERSION)，建议使用 JDK 17+"
    else
        print_success "Java 版本: $JAVA_VERSION ✓"
    fi
}

# 检查 Android SDK
check_android_sdk() {
    print_header "检查 Android SDK"

    if [ -z "$ANDROID_HOME" ]; then
        print_warning "ANDROID_HOME 环境变量未设置"

        # 尝试查找常见的 Android SDK 路径
        POSSIBLE_PATHS=(
            "$HOME/Library/Android/sdk"
            "$HOME/Android/Sdk"
            "/usr/local/android-sdk"
        )

        for path in "${POSSIBLE_PATHS[@]}"; do
            if [ -d "$path" ]; then
                print_info "找到 Android SDK: $path"
                print_info "建议在 ~/.zshrc 或 ~/.bashrc 中添加:"
                echo ""
                echo "  export ANDROID_HOME=$path"
                echo "  export PATH=\$PATH:\$ANDROID_HOME/platform-tools"
                echo "  export PATH=\$PATH:\$ANDROID_HOME/tools"
                echo ""
                export ANDROID_HOME="$path"
                export PATH="$PATH:$ANDROID_HOME/platform-tools"
                print_success "临时设置 ANDROID_HOME=$path"
                return
            fi
        done

        print_warning "未找到 Android SDK，如需 Android 开发请安装 Android Studio"
        print_info "下载地址: https://developer.android.com/studio"
    else
        print_success "ANDROID_HOME: $ANDROID_HOME ✓"

        if [ -d "$ANDROID_HOME" ]; then
            print_success "Android SDK 路径有效 ✓"
        else
            print_error "ANDROID_HOME 路径不存在: $ANDROID_HOME"
        fi
    fi
}

# 安装依赖
install_dependencies() {
    print_header "安装项目依赖"

    print_info "使用 Yarn 3.6.4 安装依赖..."
    print_info "这可能需要几分钟时间，请耐心等待..."

    corepack yarn install || {
        print_error "依赖安装失败"
        print_info "尝试清理缓存后重新安装:"
        print_info "  yarn cache clean"
        print_info "  rm -rf node_modules"
        print_info "  yarn install"
        exit 1
    }

    print_success "依赖安装完成 ✓"
}

# 创建 local.properties 模板
create_local_properties() {
    print_header "配置 Android 环境"

    if [ -z "$ANDROID_HOME" ]; then
        print_warning "跳过 local.properties 创建（ANDROID_HOME 未设置）"
        return
    fi

    LOCAL_PROPS_PATHS=(
        "3-adapter/android/IMPos2AdapterV1/android/local.properties"
        "4-assembly/android/IMPos2DesktopV1/android/local.properties"
    )

    for props_path in "${LOCAL_PROPS_PATHS[@]}"; do
        if [ ! -f "$props_path" ]; then
            mkdir -p "$(dirname "$props_path")"
            cat > "$props_path" << EOF
# Android SDK 路径配置
# 此文件由 setup.sh 自动生成
sdk.dir=$ANDROID_HOME
EOF
            print_success "创建 $props_path ✓"
        else
            print_info "$props_path 已存在，跳过"
        fi
    done
}

# 验证安装
verify_installation() {
    print_header "验证安装"

    if [ -f "scripts/check-env.js" ]; then
        print_info "运行环境检查脚本..."
        node scripts/check-env.js || {
            print_warning "环境检查发现一些问题，但不影响继续"
        }
    else
        print_warning "环境检查脚本不存在，跳过验证"
    fi

    print_success "安装验证完成 ✓"
}

# 打印后续步骤
print_next_steps() {
    print_header "安装完成！"

    echo -e "${GREEN}✓ 项目已成功配置${NC}"
    echo ""
    echo -e "${BLUE}后续步骤:${NC}"
    echo ""
    echo "  1. 启动 Mock 服务器:"
    echo "     ${YELLOW}yarn A:kernel-server${NC}"
    echo ""
    echo "  2. 启动 UI 开发服务器:"
    echo "     ${YELLOW}yarn ui:integrate-desktop-2${NC}"
    echo ""
    echo "  3. 启动 Android 应用:"
    echo "     ${YELLOW}yarn assembly:impos2-desktop-v1:start${NC}"
    echo ""
    echo "  4. 查看所有可用命令:"
    echo "     ${YELLOW}cat package.json | grep '\".*\":' | grep -v '\"---'${NC}"
    echo ""

    if [ -z "$ANDROID_HOME" ]; then
        echo -e "${YELLOW}注意: ANDROID_HOME 未设置，Android 开发功能可能不可用${NC}"
        echo "请在 ~/.zshrc 或 ~/.bashrc 中添加:"
        echo ""
        echo "  export ANDROID_HOME=\$HOME/Library/Android/sdk  # macOS"
        echo "  export PATH=\$PATH:\$ANDROID_HOME/platform-tools"
        echo ""
    fi

    echo -e "${BLUE}更多信息请查看 README.md${NC}"
    echo ""
}

# 主函数
main() {
    clear
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   IMPos2 项目自动化安装脚本           ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""

    check_node
    enable_corepack
    check_java
    check_android_sdk
    install_dependencies
    create_local_properties
    verify_installation
    print_next_steps
}

# 运行主函数
main
