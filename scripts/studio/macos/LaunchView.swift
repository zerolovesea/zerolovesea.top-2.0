import AppKit
import WebKit

final class LaunchView: NSView, WKNavigationDelegate {
    private var animation: WKWebView?
    private let reduced = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
    private var pageReady = false
    private var motionReady = false
    private var finishing = false
    private var timeout: DispatchWorkItem?

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        layer!.backgroundColor = NSColor.white.cgColor
        autoresizingMask = [.width, .height]
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func play() {
        guard animation == nil else { return }
        guard let url = Bundle.main.url(forResource: "Launch", withExtension: "html"),
              let html = try? String(contentsOf: url, encoding: .utf8) else {
            completeMotion()
            return
        }
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        let view = WKWebView(frame: bounds, configuration: configuration)
        view.autoresizingMask = [.width, .height]
        view.navigationDelegate = self
        addSubview(view)
        animation = view
        view.loadHTMLString(html.replacingOccurrences(of: "data-reduced=\"false\"", with: "data-reduced=\"\(reduced)\""), baseURL: nil)
        // A failed WebKit animation must never prevent the ready editor from opening.
        let fallback = DispatchWorkItem { [weak self] in self?.completeMotion() }
        timeout = fallback
        DispatchQueue.main.asyncAfter(deadline: .now() + 6, execute: fallback)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.callAsyncJavaScript("""
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {})));
            """, arguments: [:], in: nil, in: .page) { [weak self] _ in
                self?.completeMotion()
            }
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { completeMotion() }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { completeMotion() }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { completeMotion() }

    private func completeMotion() {
        timeout?.cancel()
        timeout = nil
        motionReady = true
        dismissIfReady()
    }
    func finish() {
        pageReady = true
        dismissIfReady()
    }
    private func dismissIfReady() {
        guard pageReady, motionReady, !finishing else { return }
        finishing = true
        NSAnimationContext.runAnimationGroup { context in
            context.duration = reduced ? 0.12 : 0.32
            self.animator().alphaValue = 0
        } completionHandler: {
            self.animation?.stopLoading()
            self.animation?.navigationDelegate = nil
            self.animation?.removeFromSuperview()
            self.animation = nil
            self.removeFromSuperview()
        }
    }
}
