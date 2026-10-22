import AppKit
import SwiftUI
import WidgetKit

struct QuickWriteEntry: TimelineEntry { let date: Date }
struct QuickWriteProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuickWriteEntry { QuickWriteEntry(date: .now) }
    func getSnapshot(in context: Context, completion: @escaping (QuickWriteEntry) -> Void) { completion(QuickWriteEntry(date: .now)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickWriteEntry>) -> Void) {
        completion(Timeline(entries: [QuickWriteEntry(date: .now)], policy: .never))
    }
}

struct QuickWriteWidgetView: View {
    @Environment(\.widgetFamily) var family

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                if let url = Bundle.main.url(forResource: "WidgetLogo", withExtension: "png"), let image = NSImage(contentsOf: url) {
                    Image(nsImage: image).resizable().scaledToFit().frame(width: 20, height: 20)
                }
                Text("Tidemark").font(.system(size: 13, weight: .semibold))
                Spacer(minLength: 0)
            }
            if family == .systemSmall {
                VStack(spacing: 6) {
                    action(.thought)
                    action(.writing)
                }
            } else {
                HStack(spacing: 10) {
                    action(.thought)
                    action(.writing)
                }
            }
        }
        .foregroundStyle(.primary)
        .widgetURL(QuickWriteKind.thought.url)
    }

    private func action(_ kind: QuickWriteKind) -> some View {
        Link(destination: kind.url) {
            HStack(spacing: 8) {
                Image(systemName: kind.symbol).font(.system(size: family == .systemSmall ? 14 : 20, weight: .regular))
                Text(kind.title).font(.system(size: 13, weight: .medium)).lineLimit(1)
                Spacer(minLength: 0)
                Image(systemName: "arrow.up.right").font(.system(size: 9, weight: .medium)).foregroundStyle(.secondary)
            }
            .padding(.horizontal, 10)
            .frame(maxWidth: .infinity, minHeight: family == .systemSmall ? 36 : 70)
            .background(.primary.opacity(0.06), in: RoundedRectangle(cornerRadius: 9))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(kind.title)
    }
}

@main
struct QuickWriteWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "top.zerolovesea.studio.quick-write", provider: QuickWriteProvider()) { _ in
            QuickWriteWidgetView().containerBackground(.background, for: .widget)
        }
        .configurationDisplayName("快速写作")
        .description("快速新建随笔或博文。")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
