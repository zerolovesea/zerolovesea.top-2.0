import AppKit

@MainActor
final class QuickThoughtPanel: NSViewController, NSPopoverDelegate, NSTextViewDelegate {
    let popover = NSPopover()
    private let port: Int
    private let token: String
    private let editor = NSTextView()
    private let status = NSTextField(wrappingLabelWithString: "支持 Markdown 与换行")
    private let log = NSTextView()
    private let progress = NSProgressIndicator()
    private let publish = NSButton(title: "发布", target: nil, action: nil)
    private let close = NSButton(title: "关闭", target: nil, action: nil)
    private var post: [String: Any]
    private var saved = false
    private(set) var busy = false
    private var work: Task<Void, Never>?
    var onPublished: (() -> Void)?
    private let defaultsKey = "quick-thought-draft"

    init(port: Int, token: String) {
        self.port = port
        self.token = token
        let previous = UserDefaults.standard.dictionary(forKey: "quick-thought-draft")
        post = previous?["document"] as? [String: Any] ?? Self.newDocument()
        saved = previous?["saved"] as? Bool ?? false
        super.init(nibName: nil, bundle: nil)
        view = NSView(frame: NSRect(x: 0, y: 0, width: 360, height: 360))
        popover.contentViewController = self
        popover.contentSize = view.frame.size
        popover.behavior = .transient
        popover.delegate = self
        let root = NSStackView()
        root.orientation = .vertical
        root.alignment = .leading
        root.spacing = 10
        root.edgeInsets = NSEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)
        root.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(root)
        NSLayoutConstraint.activate([
            root.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            root.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            root.topAnchor.constraint(equalTo: view.topAnchor),
            root.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        let title = NSTextField(labelWithString: "写一则随笔")
        title.font = .systemFont(ofSize: 18, weight: .semibold)
        root.addArrangedSubview(title)
        let note = NSTextField(wrappingLabelWithString: "发布到中文随想；网站中其他已保存的改动也会一起发布。")
        note.font = .systemFont(ofSize: 12)
        note.textColor = .secondaryLabelColor
        root.addArrangedSubview(note)
        note.widthAnchor.constraint(equalTo: root.widthAnchor, constant: -32).isActive = true
        let scroll = NSScrollView()
        scroll.hasVerticalScroller = true
        scroll.borderType = .bezelBorder
        editor.isRichText = false
        editor.isAutomaticQuoteSubstitutionEnabled = false
        editor.isAutomaticDashSubstitutionEnabled = false
        editor.font = .systemFont(ofSize: 14)
        editor.textContainerInset = NSSize(width: 12, height: 12)
        editor.isVerticallyResizable = true
        editor.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
        editor.isHorizontallyResizable = false
        editor.autoresizingMask = [.width]
        editor.textContainer?.widthTracksTextView = true
        editor.setAccessibilityLabel("随笔内容")
        editor.string = post["body"] as? String ?? ""
        editor.delegate = self
        scroll.documentView = editor
        root.addArrangedSubview(scroll)
        scroll.widthAnchor.constraint(equalTo: root.widthAnchor, constant: -32).isActive = true
        scroll.heightAnchor.constraint(greaterThanOrEqualToConstant: 100).isActive = true
        let logScroll = NSScrollView()
        logScroll.hasVerticalScroller = true
        log.isEditable = false
        log.isVerticallyResizable = true
        log.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
        log.textColor = .secondaryLabelColor
        log.setAccessibilityLabel("发布日志")
        log.isHorizontallyResizable = false
        log.autoresizingMask = [.width]
        log.textContainer?.widthTracksTextView = true
        logScroll.documentView = log
        root.addArrangedSubview(logScroll)
        logScroll.widthAnchor.constraint(equalTo: scroll.widthAnchor).isActive = true
        logScroll.heightAnchor.constraint(equalToConstant: 60).isActive = true
        logScroll.isHidden = true
        status.font = .systemFont(ofSize: 12)
        status.textColor = .secondaryLabelColor
        status.setAccessibilityLabel("发布状态")
        root.addArrangedSubview(status)
        status.widthAnchor.constraint(equalTo: scroll.widthAnchor).isActive = true
        let actions = NSStackView()
        actions.spacing = 10
        progress.style = .spinning
        progress.controlSize = .small
        progress.isDisplayedWhenStopped = false
        actions.addArrangedSubview(progress)
        let spacer = NSView()
        spacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
        actions.addArrangedSubview(spacer)
        close.target = self
        close.action = #selector(closePopover)
        close.bezelStyle = .rounded
        actions.addArrangedSubview(close)
        publish.target = self
        publish.action = #selector(submit)
        publish.bezelStyle = .rounded
        publish.keyEquivalent = "\r"
        publish.keyEquivalentModifierMask = [.command]
        actions.addArrangedSubview(publish)
        root.addArrangedSubview(actions)
        actions.widthAnchor.constraint(equalTo: scroll.widthAnchor).isActive = true
        updateButton()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    static func newDocument() -> [String: Any] {
        let format = DateFormatter()
        format.locale = Locale(identifier: "en_US_POSIX")
        format.timeZone = TimeZone(identifier: "Asia/Shanghai")
        format.dateFormat = "yyyy-MM-dd HH:mm:ss"
        let stamp = format.string(from: Date())
        return ["id": "thought/\(stamp.replacingOccurrences(of: ":", with: "-").replacingOccurrences(of: " ", with: "-"))-\(UUID().uuidString.prefix(8).lowercased()).md", "revision": NSNull(), "meta": ["title": "随笔 · \(stamp)", "description": "", "category": "随笔", "pubDate": stamp], "body": ""]
    }

    func present(relativeTo button: NSStatusBarButton) {
        popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
        NSApp.activate(ignoringOtherApps: true)
        view.window?.makeKey()
        view.window?.makeFirstResponder(editor)
    }

    private func persist() {
        post["body"] = editor.string
        // Property lists cannot store the null revision of a new post.
        var draft = post
        draft.removeValue(forKey: "revision")
        if let revision = post["revision"] as? String { draft["revision"] = revision }
        UserDefaults.standard.set(["document": draft, "saved": saved], forKey: defaultsKey)
    }

    func textDidChange(_ notification: Notification) { persist(); updateButton() }
    func serviceStopped() { work?.cancel(); busy = false }
    private func updateButton() { publish.isEnabled = !busy && !editor.string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    @objc private func closePopover() { popover.performClose(nil) }
    func popoverShouldClose(_ popover: NSPopover) -> Bool { persist(); return true }

    private func request(_ route: String, _ payload: [String: Any]? = nil) async throws -> [String: Any] {
        var request = URLRequest(url: URL(string: "http://127.0.0.1:\(port)/api/\(route)")!)
        request.timeoutInterval = 60
        request.setValue(token, forHTTPHeaderField: "x-studio-token")
        if let payload {
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        let result = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
        guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode) else {
            throw NSError(domain: "Tidemark", code: 1, userInfo: [NSLocalizedDescriptionKey: result["error"] as? String ?? "本地服务请求失败"])
        }
        return result
    }

    @objc private func submit() {
        guard !busy, !editor.string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        busy = true
        editor.isEditable = false
        updateButton()
        progress.startAnimation(nil)
        status.stringValue = "正在保存随笔…"
        log.string = ""
        log.enclosingScrollView?.isHidden = false
        persist()
        work = Task {
            do {
                let current = try await request("publish-status")
                if current["running"] as? Bool == true { throw NSError(domain: "Tidemark", code: 1, userInfo: [NSLocalizedDescriptionKey: "另一个网站发布正在进行，请稍后重试。"] ) }
                if !saved {
                    // Recover a successful save whose HTTP response was lost, without overwriting another edit.
                    let id = post["id"] as! String
                    let encoded = id.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)!
                    if let existing = try? await request("document?id=\(encoded)"), existing["body"] as? String == editor.string {
                        post = existing
                        saved = true
                    }
                }
                post["body"] = editor.string
                if post["revision"] == nil { post["revision"] = NSNull() }
                post = try await request("save", post)
                saved = true
                persist()
                let plan = try await request("publish-plan")
                var startFailure: Error?
                do { _ = try await request("publish", ["confirmation": "发布网站", "fingerprint": plan["fingerprint"] as! String]) }
                catch {
                    guard (error as NSError).domain == NSURLErrorDomain else { throw error }
                    startFailure = error
                }
                status.stringValue = "正在发布网站…"
                while true {
                    let state: [String: Any]
                    do { state = try await request("publish-status") }
                    catch {
                        status.stringValue = "连接中断，正在重新确认发布状态…"
                        try await Task.sleep(nanoseconds: 2_000_000_000)
                        continue
                    }
                    if let startFailure, state["started"] as? String == current["started"] as? String { throw startFailure }
                    status.stringValue = "正在发布网站…"
                    log.string = String((state["log"] as? String ?? "").suffix(12000))
                    log.scrollToEndOfDocument(nil)
                    if state["running"] as? Bool != true {
                        guard state["exitCode"] as? Int == 0 else { throw NSError(domain: "Tidemark", code: 1, userInfo: [NSLocalizedDescriptionKey: "发布失败，随笔已保存。请查看日志后重试。"]) }
                        status.stringValue = "发布完成"
                        publish.title = "发布"
                        onPublished?()
                        post = Self.newDocument()
                        saved = false
                        editor.string = ""
                        UserDefaults.standard.removeObject(forKey: defaultsKey)
                        break
                    }
                    try await Task.sleep(nanoseconds: 1_000_000_000)
                }
            } catch {
                status.stringValue = saved ? "发布未完成 · 随笔已保存，可重试" : "未发布 · 输入内容已保留"
                log.string += "\n" + error.localizedDescription
                log.scrollToEndOfDocument(nil)
                publish.title = "重试发布"
            }
            busy = false
            editor.isEditable = true
            progress.stopAnimation(nil)
            updateButton()
        }
    }
}
