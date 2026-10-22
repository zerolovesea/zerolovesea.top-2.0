import AppKit
import QuartzCore

final class LaunchView: NSView {
    private let waves = (0..<3).map { _ in CAShapeLayer() }
    private let mark = CALayer()
    private let title = CATextLayer()
    private let caption = CATextLayer()
    private let reveal = CALayer()
    private let reduced = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
    private let created = Date()
    private var finishing = false

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        layer!.backgroundColor = NSColor.white.cgColor
        autoresizingMask = [.width, .height]
        for wave in waves {
            wave.fillColor = nil
            wave.strokeColor = NSColor.black.cgColor
            wave.lineWidth = 1
            layer!.addSublayer(wave)
        }
        mark.contents = NSImage(named: "StatusIcon")?.cgImage(forProposedRect: nil, context: nil, hints: nil)
        mark.contentsGravity = .resizeAspect
        layer!.addSublayer(mark)
        title.string = "Tidemark"
        title.font = NSFont.systemFont(ofSize: 42, weight: .medium)
        title.fontSize = 42
        title.alignmentMode = .center
        title.foregroundColor = NSColor.black.cgColor
        title.contentsScale = NSScreen.main?.backingScaleFactor ?? 2
        layer!.addSublayer(title)
        reveal.backgroundColor = NSColor.black.cgColor
        reveal.anchorPoint = CGPoint(x: 0, y: 0.5)
        title.mask = reveal
        caption.string = "写下此刻，留下潮痕。"
        caption.font = NSFont.systemFont(ofSize: 12)
        caption.fontSize = 12
        caption.alignmentMode = .center
        caption.foregroundColor = NSColor(calibratedWhite: 0.42, alpha: 1).cgColor
        caption.contentsScale = title.contentsScale
        layer!.addSublayer(caption)
        needsLayout = true
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func tide(_ amplitude: CGFloat, width: CGFloat) -> CGPath {
        let path = CGMutablePath()
        path.move(to: CGPoint(x: 0, y: 0))
        path.addCurve(to: CGPoint(x: width / 2, y: 0), control1: CGPoint(x: width * 0.18, y: amplitude), control2: CGPoint(x: width * 0.32, y: -amplitude))
        path.addCurve(to: CGPoint(x: width, y: 0), control1: CGPoint(x: width * 0.68, y: amplitude), control2: CGPoint(x: width * 0.82, y: -amplitude))
        return path
    }
    override func layout() {
        super.layout()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        let center = CGPoint(x: bounds.midX, y: bounds.midY)
        let width = min(460, bounds.width - 100)
        for (index, wave) in waves.enumerated() {
            wave.frame = CGRect(x: center.x - width / 2, y: center.y - 48, width: width, height: 1)
            wave.path = tide(CGFloat(index - 1) * 3, width: width)
            wave.opacity = 0
        }
        mark.frame = CGRect(x: center.x - 36, y: center.y + 48, width: 72, height: 72)
        title.frame = CGRect(x: center.x - 170, y: center.y - 5, width: 340, height: 54)
        reveal.bounds = CGRect(x: 0, y: 0, width: 340, height: 54)
        reveal.position = CGPoint(x: 0, y: 27)
        caption.frame = CGRect(x: center.x - 180, y: center.y - 94, width: 360, height: 24)
        CATransaction.commit()
    }
    private func animate(_ layer: CALayer, _ key: String, from: Any, to: Any, delay: Double, duration: Double) {
        let animation = CABasicAnimation(keyPath: key)
        animation.fromValue = from
        animation.toValue = to
        animation.beginTime = CACurrentMediaTime() + delay
        animation.duration = duration
        animation.timingFunction = CAMediaTimingFunction(controlPoints: 0.16, 1, 0.3, 1)
        animation.fillMode = .backwards
        layer.add(animation, forKey: key)
    }
    func play() {
        layoutSubtreeIfNeeded()
        guard !reduced else { return }
        for (index, wave) in waves.enumerated() {
            let delay = Double(index) * 0.09
            animate(wave, "path", from: tide([48, -36, 24][index], width: wave.bounds.width), to: wave.path!, delay: delay, duration: 1.05)
            animate(wave, "strokeEnd", from: 0, to: 1, delay: delay, duration: 0.78)
            let opacity = CAKeyframeAnimation(keyPath: "opacity")
            opacity.values = [0, 0.22, 0.22, 0]
            opacity.keyTimes = [0, 0.15, 0.7, 1]
            opacity.duration = 1.4
            opacity.beginTime = CACurrentMediaTime() + delay
            wave.add(opacity, forKey: "tide-opacity")
        }
        animate(mark, "opacity", from: 0, to: 1, delay: 0.24, duration: 0.7)
        animate(mark, "transform.scale", from: 0.84, to: 1, delay: 0.24, duration: 0.85)
        animate(reveal, "transform.scale.x", from: 0, to: 1, delay: 0.48, duration: 0.72)
        animate(title, "transform.translation.y", from: -7, to: 0, delay: 0.48, duration: 0.72)
        animate(caption, "opacity", from: 0, to: 1, delay: 0.82, duration: 0.5)
    }
    func finish() {
        guard !finishing else { return }
        finishing = true
        let delay = reduced ? 0 : max(0, 1.6 - Date().timeIntervalSince(created))
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self else { return }
            NSAnimationContext.runAnimationGroup { context in
                context.duration = self.reduced ? 0.12 : 0.32
                self.animator().alphaValue = 0
            } completionHandler: { self.removeFromSuperview() }
        }
    }
}
