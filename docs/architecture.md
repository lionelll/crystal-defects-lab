# 晶体缺陷本地应用分层

依据公共 `三项目统一代码架构规范.md` 的逻辑分层方法，本项目保留独立代码边界：

| 层次 | 本项目位置 | 职责 |
|---|---|---|
| 入口与壳 | `index.html`、`src/main.tsx`、`src/App.tsx`、`src/styles.css`、`src/shared-lab-theme.css`、`src/components/AppErrorBoundary.tsx` | 启动、全局错误边界、页面装配与三项目共享的深色视觉层 |
| 界面组件 | `src/components/` | 图标、三维视口宿主与纯界面控件 |
| 应用状态 | `src/app/` | 选择、播放、暂停、单步、进度和速度；逐帧播放头保存在 ref，界面进度约每 50 ms 同步 |
| 可视化渲染 | `src/render/` | Three.js 对象、材质、相机与几何表达；动态绘图池复用对象和 GPU 缓冲 |
| 领域计算 | `src/domain/geometry.ts`、`src/domain/sceneGeometry.ts` | 伯氏矢量、位错线、原子位置与过程阶段几何；无 React、DOM、CSS 或服务器依赖 |
| 领域数据 | `src/data/scenes.ts` | 15 场景的范围、教学文案与阶段标签 |
| 基础设施 | `vite.config.ts`、`package.json` | 本地构建；`/defects/` 基路径只在 Vite 配置中定义 |
| 验证与证据 | `src/domain/*.test.ts`、`design-qa.md`、`docs/qa/` | 纯函数回归、浏览器检查和视觉证据 |

依赖方向为页面和状态读取场景数据，渲染层读取领域计算结果；领域计算只读取领域数据与纯矢量函数。公共 Logo 已作为本仓库运行时副本 `public/logo.png` 保存，页面不读取父目录文件；旧项目源码、服务器目录和 Git 引用均不作为运行时依赖。

当前还需逐步压缩渲染层中的剩余形状构建参数，并用学科审核后的约束替换交割、双交滑移候选构型。此图文只描述现阶段代码职责，不代表物理模型或版本发布已验收。
