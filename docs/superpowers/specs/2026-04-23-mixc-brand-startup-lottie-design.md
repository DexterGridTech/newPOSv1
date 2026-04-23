# Mixc Retail RN84 Brand Startup Lottie Design

Date: 2026-04-23

## Goal

为 `4-assembly/android/mixc-retail-assembly-rn84` 的主屏启动遮罩提供一个原创品牌向 Lottie 片头，品牌名称为“华润万象生活”。

目标气质：

- 高端大气
- 重奢购物中心风
- 克制、精致、非互联网炫技感
- 适合冷启动原生遮罩场景，在 JS ready 前稳定播放

## Constraints

- 动画必须运行在 Android 原生启动遮罩中，不能依赖 RN runtime 已加载。
- 不引入图片序列或视频资源，优先使用 Lottie 矢量动画，减小包体并保证启动性能。
- 不直接复刻受保护的官方 logo 图形，采用原创抽象视觉语言表达品牌气质。
- 保持现有启动编排不变：冷启动显示、ready 后按既有链路淡出；重启默认不重新展示。

## Visual Direction

主题名：万象之门

视觉构成：

1. 以“中庭穹顶 / 奢华商场入口 / 金属灯带”为灵感来源。
2. 先由细金线在中心汇聚，再向外展开成门廊与穹顶轮廓。
3. 形成多层香槟金环轨，表现空间秩序、动线与品牌仪式感。
4. 中心区域出现柔和光晕与稳定核心，暗示高端服务与生活方式平台。
5. 最终品牌文案“华润万象生活”稳态呈现，动画进入低速循环等待启动完成。

## Palette

- Background: `#F8F4EC`
- Champagne Gold: `#C8A45D`
- Warm Gold Highlight: `#E7C98A`
- Deep Obsidian Text: `#151515`
- Soft Shadow Gold: `#B68C45`

## Motion Language

- 节奏：慢起、稳态、低速循环
- 动作：描边展开、轨道旋转、脉冲呼吸、文字淡入
- 避免：跳跃、弹簧感、强科技蓝紫、夸张粒子爆炸

建议时间结构：

1. `0s - 0.8s` 金线与核心光点建立
2. `0.8s - 1.8s` 穹顶/门廊结构展开
3. `1.8s - 2.6s` 品牌文字淡入
4. `2.6s+` 低速光轨循环，等待启动完成

## Implementation Notes

- Lottie JSON 资源放在 `android/app/src/main/res/raw/startup_intro.json`
- `launch_screen.xml` 内使用 `LottieAnimationView`
- `StartupOverlayManager` 在 `show()` 时播放，在移除前取消动画
- 若后续拿到正式品牌动效设计稿，只替换 `startup_intro.json`，不改宿主逻辑

## Testing

- `./gradlew :app:assembleDebug`
- 冷启动观察：系统 Splash 结束后应无白屏，直接进入品牌片头
- JS ready 后遮罩应正常淡出
- Activity 销毁/重建时不应出现动画残留或重复叠层
