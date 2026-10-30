import AppKit

let source = NSBitmapImageRep(data: try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))!
let mask = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: source.pixelsWide, pixelsHigh: source.pixelsHigh, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
var left = source.pixelsWide, right = 0, top = source.pixelsHigh, bottom = 0
for y in 0..<source.pixelsHigh {
    for x in 0..<source.pixelsWide {
        let color = source.colorAt(x: x, y: y)!.usingColorSpace(.deviceRGB)!
        let alpha = (1 - max(color.redComponent, color.greenComponent, color.blueComponent)) * color.alphaComponent
        // An RGB bitmap needs an RGB color; grayscale setColor silently discarded alpha.
        mask.setColor(NSColor(deviceRed: 0, green: 0, blue: 0, alpha: alpha), atX: x, y: y)
        if alpha > 0.03 { left = min(left, x); right = max(right, x); top = min(top, y); bottom = max(bottom, y) }
    }
}
assert(left < right && top < bottom, "博客图标缺少可见轮廓")
// Remove the favicon's large white margins so the cat remains legible at 18 points.
let width = right - left + 5, height = bottom - top + 5
let cropped = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
for y in top...bottom { for x in left...right { cropped.setColor(mask.colorAt(x: x, y: y)!, atX: x - left + 2, y: y - top + 2) } }
let data = cropped.representation(using: .png, properties: [:])!
let check = NSBitmapImageRep(data: data)!
var visible = 0
for y in 0..<height { for x in 0..<width { if check.colorAt(x: x, y: y)!.alphaComponent > 0.1 { visible += 1 } } }
assert(visible > width * height / 20, "导出的菜单栏图标完全透明")
assert(check.hasAlpha, "模板图标必须保留透明通道")
for (x, y) in [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)] {
    assert(check.colorAt(x: x, y: y)!.alphaComponent == 0, "模板图标背景必须透明，否则小组件着色会变成方块")
}
try data.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
