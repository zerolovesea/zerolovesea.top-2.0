import AppKit
import WebKit

@MainActor
final class Studio: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
    var window: NSWindow!
    var web: WKWebView!
    var service: Process?
    var output: Pipe?
    var ready = false
    var stopping = false
    var logs = ""
    var statusItem: NSStatusItem!
    var lowPowerItem: NSMenuItem!
    var launchView: LaunchView?
    var lowPowerMenuItem: NSMenuItem!
    var lowPower = UserDefaults.standard.object(forKey: "low-power-residency") as? Bool ?? true
    var snapshot: String?
    var suspending = false
    var backgroundGeneration = 0
    let port = 4342
    var project: URL!
    var editorReady = false
    var pendingQuickWrite: QuickWriteKind?
    var deliveringQuickWrite = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        makeMenu()
        makeStatusItem()
        makeWebView()
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 840), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Tidemark · ZeroLoveSeA"
        window.isReleasedWhenClosed = false
        window.minSize = NSSize(width: 900, height: 640)
        window.setFrameAutosaveName("studio-main")
        window.contentView = web
        let launch = LaunchView(frame: web.bounds)
        launchView = launch
        web.addSubview(launch, positioned: .above, relativeTo: nil)
        launch.play()
        window.delegate = self
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        guard let resource = Bundle.main.url(forResource: "project", withExtension: "txt"),
              let path = try? String(contentsOf: resource, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines) else {
            fail("应用缺少项目路径，请重新运行 bun run studio:macos:build。")
            return
        }
        project = URL(fileURLWithPath: path, isDirectory: true)
        start()
    }

    func makeWebView() {
        editorReady = false
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = false
    }

    func makeStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let url = Bundle.main.url(forResource: "StatusIcon", withExtension: "png"), let image = NSImage(contentsOf: url) {
            image.size = NSSize(width: 18, height: 18)
            image.isTemplate = true
            statusItem.button?.image = image
            statusItem.button?.imageScaling = .scaleProportionallyDown
        } else { statusItem.button?.title = "T" }
        statusItem.button?.toolTip = "Tidemark"
        statusItem.button?.setAccessibilityLabel("Tidemark")
        let menu = NSMenu()
        func add(_ title: String, _ action: Selector) -> NSMenuItem {
            let item = NSMenuItem(title: title, action: action, keyEquivalent: "")
            item.target = self
            menu.addItem(item)
            return item
        }
        _ = add("打开 Tidemark", #selector(showWindow))
        lowPowerItem = add("节能模式", #selector(toggleLowPower))
        lowPowerItem.state = lowPower ? .on : .off
        menu.addItem(.separator())
        let quit = add("退出 Tidemark", #selector(quit))
        quit.keyEquivalent = "q"
        statusItem.menu = menu
    }

    @objc func showWindow() {
        backgroundGeneration += 1
        suspending = false
        web?.evaluateJavaScript("window.studioNative?.foreground()", completionHandler: nil)
        NSApp.setActivationPolicy(.regular)
        NSApp.unhide(nil)
        if web == nil {
            makeWebView()
            window.contentView = web
            web.load(URLRequest(url: URL(string: "http://127.0.0.1:\(port)/")!))
        }
        window.deminiaturize(nil)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
    @objc func quit() { NSApp.terminate(nil) }
    @objc func toggleLowPower() {
        lowPower.toggle()
        UserDefaults.standard.set(lowPower, forKey: "low-power-residency")
        lowPowerItem.state = lowPower ? .on : .off
        lowPowerMenuItem.state = lowPower ? .on : .off
        if !window.isVisible || NSApp.isHidden { background() }
    }
    @objc func stopPreview() {
        guard let web, ready else { return }
        web.callAsyncJavaScript("return await window.studioNative.stopPreview()", arguments: [:], in: nil, in: .page) { result in
            if case .failure(let error) = result, self.window.isVisible {
                let alert = NSAlert(); alert.messageText = "暂时无法停止预览"; alert.informativeText = error.localizedDescription
                alert.beginSheetModal(for: self.window)
            }
        }
    }
    func background() {
        guard ready, let current = web, !suspending else { return }
        suspending = true
        backgroundGeneration += 1
        let generation = backgroundGeneration
        current.callAsyncJavaScript("return await window.studioNative.background()", arguments: [:], in: nil, in: .page) { result in
            guard generation == self.backgroundGeneration else { return }
            self.suspending = false
            guard !self.stopping, self.web === current, !self.window.isVisible || NSApp.isHidden else { return }
            if self.lowPower, case .success(let value) = result, let state = value as? String {
                self.snapshot = state
                current.stopLoading()
                self.window.contentView = NSView()
                self.web = nil
            }
        }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard webView.url?.port == port else { return }
        webView.callAsyncJavaScript("""
            if (!window.studioNative?.ready) {
                await new Promise((resolve, reject) => {
                    const timer = setTimeout(() => reject(new Error('编辑器加载超时')), 15000);
                    window.addEventListener('tidemark-ready', () => { clearTimeout(timer); resolve(); }, {once:true});
                });
            }
            if (snapshot) return await window.studioNative.restore(snapshot);
            return true;
            """, arguments: ["snapshot": snapshot ?? ""], in: nil, in: .page) { result in
                self.launchView?.finish()
                self.launchView = nil
                if case .success = result {
                    self.snapshot = nil
                    self.editorReady = true
                    self.deliverQuickWrite()
                }
                else {
                    let alert = NSAlert(); alert.messageText = "上次页面暂时无法恢复"
                    alert.informativeText = "可以重新从集合打开文档；本地文件和草稿仍保留。"
                    alert.beginSheetModal(for: self.window)
                }
            }
    }

    func application(_ application: NSApplication, open urls: [URL]) {
        guard let kind = urls.compactMap({ QuickWriteKind(url: $0) }).last else { return }
        pendingQuickWrite = kind
        if window != nil { showWindow(); deliverQuickWrite() }
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        if webView === web { editorReady = false }
    }

    func deliverQuickWrite() {
        guard editorReady, let web, let kind = pendingQuickWrite, !deliveringQuickWrite else { return }
        pendingQuickWrite = nil
        deliveringQuickWrite = true
        web.callAsyncJavaScript("return await window.studioNative.quickWrite(kind)", arguments: ["kind": kind.rawValue], in: nil, in: .page) { result in
            self.deliveringQuickWrite = false
            if case .failure(let error) = result {
                let alert = NSAlert()
                alert.messageText = "暂时无法新建内容"
                alert.informativeText = error.localizedDescription
                alert.beginSheetModal(for: self.window)
            }
            self.deliverQuickWrite()
        }
    }

    func makeMenu() {
        let menu = NSMenu()
        NSApp.mainMenu = menu
        func section(_ title: String) -> NSMenu {
            let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
            let submenu = NSMenu(title: title)
            item.submenu = submenu
            menu.addItem(item)
            return submenu
        }
        func item(_ menu: NSMenu, _ title: String, _ action: Selector, _ key: String = "") {
            let entry = NSMenuItem(title: title, action: action, keyEquivalent: key)
            entry.target = self
            menu.addItem(entry)
        }
        let app = section("Tidemark")
        item(app, "关于 Tidemark", #selector(about))
        app.addItem(.separator())
        app.addItem(withTitle: "隐藏 Tidemark", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        app.addItem(.separator())
        app.addItem(withTitle: "退出 Tidemark", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let file = section("文件")
        item(file, "保存文档", #selector(save), "s")
        item(file, "在 Finder 中显示项目", #selector(revealProject))
        item(file, "关闭窗口", #selector(closeWindow), "w")
        let edit = section("编辑")
        for (title, action, key) in [("撤销", "undo:", "z"), ("剪切", "cut:", "x"), ("复制", "copy:", "c"), ("粘贴", "paste:", "v"), ("全选", "selectAll:", "a")] {
            edit.addItem(withTitle: title, action: Selector(action), keyEquivalent: key)
        }
        let redo = edit.addItem(withTitle: "重做", action: Selector(("redo:")), keyEquivalent: "z")
        redo.keyEquivalentModifierMask = [.command, .shift]
        item(edit, "搜索内容", #selector(search), "k")
        let view = section("显示")
        lowPowerMenuItem = NSMenuItem(title: "节能常驻（释放空闲编辑器）", action: #selector(toggleLowPower), keyEquivalent: "")
        lowPowerMenuItem.target = self
        lowPowerMenuItem.state = lowPower ? .on : .off
        view.addItem(lowPowerMenuItem)
        item(view, "停止本地预览", #selector(stopPreview))
        view.addItem(.separator())
        item(view, "重新载入", #selector(reload), "r")
        item(view, "切换全屏", #selector(fullscreen))
        let windows = section("窗口")
        windows.addItem(withTitle: "最小化", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        NSApp.windowsMenu = windows
    }

    func start() {
        let fm = FileManager.default
        guard fm.fileExists(atPath: project.appendingPathComponent("scripts/studio-server.ts").path),
              fm.fileExists(atPath: project.appendingPathComponent("node_modules/astro").path) else {
            fail("找不到项目或依赖。请在原项目执行 bun install，然后重新构建应用。\n\(project.path)")
            return
        }
        let bundled = Bundle.main.url(forResource: "bun", withExtension: nil)!
        let task = Process()
        task.executableURL = bundled
        task.arguments = [project.appendingPathComponent("scripts/studio-server.ts").path]
        task.currentDirectoryURL = project
        task.qualityOfService = .utility
        var environment = ProcessInfo.processInfo.environment
        environment["PATH"] = "\(bundled.deletingLastPathComponent().path):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
        environment["STUDIO_PORT"] = String(port)
        environment["STUDIO_PREVIEW_PORT"] = String(port + 1)
        environment["STUDIO_LLM_API_KEY"] = ""
        task.environment = environment
        let pipe = Pipe()
        task.standardOutput = pipe
        task.standardError = pipe
        output = pipe
        pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else { return }
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.logs = String((self.logs + text).suffix(12000))
                if !self.ready && self.logs.contains("local studio →") {
                    self.ready = true
                    self.web?.load(URLRequest(url: URL(string: "http://127.0.0.1:\(self.port)/")!))
                }
            }
        }
        task.terminationHandler = { [weak self] process in
            Task { @MainActor [weak self] in
                guard let self, !self.stopping else { return }
                self.fail("本地服务已退出（\(process.terminationStatus)）。端口 \(self.port) 可能被占用。\n\(self.logs)")
            }
        }
        do {
            service = task
            try task.run()
            DispatchQueue.main.asyncAfter(deadline: .now() + 20) { [weak self] in
                guard let self, !self.ready, !self.stopping else { return }
                self.fail("本地服务启动超时。\n\(self.logs)")
            }
        } catch { fail("无法启动本地服务：\(error.localizedDescription)") }
    }

    func fail(_ message: String) {
        let alert = NSAlert()
        alert.messageText = "Tidemark 无法运行"
        alert.informativeText = message
        alert.alertStyle = .critical
        alert.runModal()
        NSApp.terminate(nil)
    }

    func confirmLeaving(_ completion: @escaping (Bool) -> Void) {
        guard ready, let web else { completion(true); return }
        web.evaluateJavaScript("({busy: window.studioNative?.isBusy() ?? false, publishing: window.studioNative?.isPublishing?.() ?? false})") { value, error in
            if let state = value as? [String: Any], state["publishing"] as? Bool == true {
                let alert = NSAlert()
                alert.messageText = "网站正在发布"
                alert.informativeText = "请等待发布完成后再退出，避免中断提交、推送或部署。"
                alert.addButton(withTitle: "继续等待")
                alert.runModal()
                completion(false)
                return
            }
            // A crashed page cannot confirm that its latest edits reached disk.
            if ((value as? [String: Any])?["busy"] as? Bool == true) || error != nil {
                let alert = NSAlert()
                alert.messageText = "仍有未保存内容或任务正在进行"
                alert.informativeText = "建议返回保存文件并等待上传、翻译完成。继续会中断当前任务；已完成的自动草稿可在下次启动时恢复。"
                alert.addButton(withTitle: "返回编辑")
                alert.addButton(withTitle: "继续")
                completion(alert.runModal() == .alertSecondButtonReturn)
            } else { completion(true) }
        }
    }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if stopping { return .terminateNow }
        if !ready || web == nil { stop(); return .terminateNow }
        confirmLeaving { allow in
            if allow { self.stop() }
            sender.reply(toApplicationShouldTerminate: allow)
        }
        return .terminateLater
    }
    func stop() {
        stopping = true
        output?.fileHandleForReading.readabilityHandler = nil
        if let service, service.isRunning {
            service.terminate()
            // The server handles SIGTERM and stops its preview subprocess.
            let deadline = Date().addingTimeInterval(3)
            while service.isRunning && Date() < deadline { Thread.sleep(forTimeInterval: 0.02) }
            if service.isRunning { kill(service.processIdentifier, SIGKILL) }
        }
    }
    func applicationWillTerminate(_ notification: Notification) { if !stopping { stop() } }
    func windowShouldClose(_ sender: NSWindow) -> Bool { closeWindow(); return false }
    func applicationDidHide(_ notification: Notification) { background() }
    func applicationDidUnhide(_ notification: Notification) { showWindow() }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showWindow()
        return true
    }
    @objc func save() { web?.evaluateJavaScript("window.studioNative?.save()", completionHandler: nil) }
    @objc func search() { web?.evaluateJavaScript("window.studioNative?.search()", completionHandler: nil) }
    @objc func revealProject() { if let project { NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: project.path) } }
    @objc func closeWindow() {
        window.orderOut(nil)
        NSApp.setActivationPolicy(.accessory)
        background()
    }
    @objc func fullscreen() { window.toggleFullScreen(nil) }
    @objc func reload() { confirmLeaving { if $0 { self.web?.reload() } } }
    @objc func about() {
        NSApp.orderFrontStandardAboutPanel(options: [.applicationName: "Tidemark", .applicationVersion: "1.3", .credits: NSAttributedString(string: "ZeroLoveSeA · 本地博文与 thought 管理\nAppKit + WebKit · 内容保存到当前博客项目")])
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.scheme == "about" || (url.scheme == "http" && url.host == "127.0.0.1" && [port, port + 1].contains(url.port ?? 0)) {
            decisionHandler(.allow)
        } else {
            if navigationAction.navigationType == .linkActivated && ["https", "http", "mailto"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
            decisionHandler(.cancel)
        }
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, ["https", "http"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
        return nil
    }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.canChooseFiles = true
        panel.beginSheetModal(for: window) { completionHandler($0 == .OK ? panel.urls : nil) }
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert(); alert.messageText = message
        alert.beginSheetModal(for: window) { _ in completionHandler() }
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert(); alert.messageText = message
        alert.addButton(withTitle: "确定"); alert.addButton(withTitle: "取消")
        alert.beginSheetModal(for: window) { completionHandler($0 == .alertFirstButtonReturn) }
    }
}

@main
struct Main {
    @MainActor static func main() {
        let app = NSApplication.shared
        let delegate = Studio()
        app.delegate = delegate
        app.setActivationPolicy(.regular)
        withExtendedLifetime(delegate) { app.run() }
    }
}
