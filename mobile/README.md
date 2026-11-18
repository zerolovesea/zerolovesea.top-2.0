# Tidemark iOS

只读 iPhone/iPad 应用，最低 iOS 17。博客通过线上 RSS 获取，在应用内打开完整网页。阅读概览和六个时间范围的小组件使用独立的鉴权汇总接口。

## 使用

安装后直接读取汇总统计，无需访问密钥。统计缓存保存在 App Group 的受系统文件保护目录，供应用与小组件共享。

长按主屏幕添加 Tidemark 阅读统计，选择今天、24 小时、7 天、15 天、30 天或半年。支持小、中、大尺寸。小组件请求约 15 分钟后的时间线，实际刷新由 iOS 调度，离线显示上次成功数据及时间。应用下拉刷新后会通知 WidgetKit 更新。

## 构建与上传

直接打开 `mobile/Tidemark.xcodeproj`，选择 Tidemark Scheme 和 Release，Archive 后通过 App Store Connect 分发。团队为 4M64879BBM。主应用 Bundle ID 为 `top.zerolovesea.tidemark.reader`，小组件为 `top.zerolovesea.tidemark.reader.widgets`。App Group 为 `group.top.zerolovesea.tidemark.reader`。

`bun mobile/generate.ts` 可重建项目配置。品牌素材来自现有博客和桌面应用图标。

统计 Worker 在 `workers/mobile-reader`。GET `https://zerolovesea.top/api/mobile/overview?period=week` 允许匿名读取，仅返回聚合统计。数据库时段按北京时间计算，UV 在整个所选时间段内去重。
