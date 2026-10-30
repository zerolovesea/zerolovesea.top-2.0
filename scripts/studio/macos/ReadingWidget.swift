import AppKit
import SwiftUI
import WidgetKit
import Charts

// Separate gallery entries keep time-range selection available without App Intents metadata.
enum ReadingPeriod: String, CaseIterable {
    case today, day, week, fortnight, month, halfYear
    var label: String {
        switch self {
        case .today: return "今天"
        case .day: return "近24小时"
        case .week: return "近7天"
        case .fortnight: return "近15天"
        case .month: return "近30天"
        case .halfYear: return "近半年"
        }
    }
}

struct ReadingSeries: Codable {
    let labels: [String]
    let values: [Int]
    let uniques: [Int]
}
struct ReadingRank: Codable {
    let k: String?
    let n: Int
}
struct ReadingWindow: Codable {
    let views: Int
    let visitors: Int
    let timeseries: ReadingSeries
    let country: [ReadingRank]
    let city: [ReadingRank]
    let language: [ReadingRank]
}
struct ReadingSnapshot: Codable {
    let generatedAt: String
    let stale: Bool
    let windows: [String: ReadingWindow]
    var generatedDate: Date? {
        let format = ISO8601DateFormatter()
        format.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return format.date(from: generatedAt) ?? ISO8601DateFormatter().date(from: generatedAt)
    }
    static let preview = ReadingSnapshot(generatedAt: "2026-10-28T00:00:00.000Z", stale: false, windows: Dictionary(uniqueKeysWithValues: ReadingPeriod.allCases.map { ($0.label, ReadingWindow(views: 0, visitors: 0, timeseries: ReadingSeries(labels: [], values: [], uniques: []), country: [], city: [], language: [])) }))
}

struct ReadingEntry: TimelineEntry {
    let date: Date
    let period: ReadingPeriod
    let snapshot: ReadingSnapshot?
    let offline: Bool
    var window: ReadingWindow? { snapshot?.windows[period.label] }
}

struct ReadingCache {
    let file: URL
    func read() -> ReadingSnapshot? {
        guard let data = try? Data(contentsOf: file) else { return nil }
        return try? JSONDecoder().decode(ReadingSnapshot.self, from: data)
    }
    func write(_ data: Data) throws {
        _ = try JSONDecoder().decode(ReadingSnapshot.self, from: data)
        try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
        try data.write(to: file, options: .atomic)
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
    }
    static var local: ReadingCache {
        let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        return ReadingCache(file: base.appendingPathComponent("Tidemark/reading-widget.json"))
    }
}

struct ReadingProvider: TimelineProvider {
    let period: ReadingPeriod
    func placeholder(in context: Context) -> ReadingEntry {
        ReadingEntry(date: .now, period: period, snapshot: .preview, offline: false)
    }
    func getSnapshot(in context: Context, completion: @escaping (ReadingEntry) -> Void) {
        completion(ReadingEntry(date: .now, period: period, snapshot: ReadingCache.local.read(), offline: true))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<ReadingEntry>) -> Void) {
        Task {
            let cached = ReadingCache.local.read()
            if let date = cached?.generatedDate, Date.now.timeIntervalSince(date) < 15 * 60 {
                completion(timeline(cached, offline: false))
                return
            }
            do {
                guard let resource = Bundle.main.url(forResource: "WidgetToken", withExtension: "txt") else { throw URLError(.userAuthenticationRequired) }
                let token = try String(contentsOf: resource, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines)
                let data = try await fetchReading(token: token)
                try ReadingCache.local.write(data)
                let snapshot = try JSONDecoder().decode(ReadingSnapshot.self, from: data)
                completion(timeline(snapshot, offline: snapshot.stale))
            } catch {
                completion(timeline(cached, offline: true))
            }
        }
    }
    private func timeline(_ snapshot: ReadingSnapshot?, offline: Bool) -> Timeline<ReadingEntry> {
        let entry = ReadingEntry(date: .now, period: period, snapshot: snapshot, offline: offline)
        return Timeline(entries: [entry], policy: .after(Date.now.addingTimeInterval(30 * 60)))
    }
}

func fetchReading(token: String, endpoint: URL = URL(string: "http://127.0.0.1:4342/api/widget-analytics")!) async throws -> Data {
    var request = URLRequest(url: endpoint, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 10)
    request.setValue(token, forHTTPHeaderField: "x-tidemark-widget-token")
    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { throw URLError(.badServerResponse) }
    let snapshot = try JSONDecoder().decode(ReadingSnapshot.self, from: data)
    guard snapshot.generatedDate != nil else { throw URLError(.cannotParseResponse) }
    return data
}

struct ReadingStatsView: View {
    let entry: ReadingEntry
    let family: WidgetFamily
    private var small: Bool { family == .systemSmall }
    private var large: Bool { family == .systemLarge }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                if let url = Bundle.main.url(forResource: "WidgetLogo", withExtension: "png"), let image = NSImage(contentsOf: url) {
                    Image(nsImage: image).renderingMode(.template).resizable().scaledToFit().frame(width: 16, height: 16)
                }
                Text("阅读概览").font(.system(size: 12, weight: .medium))
                Spacer(minLength: 0)
                Text(entry.period.label).font(.system(size: 10)).foregroundStyle(.secondary)
            }
            if let data = entry.window {
                if small {
                    metrics(data)
                    trend(data)
                } else if large {
                    metrics(data)
                    trend(data).frame(maxHeight: 64)
                    Divider()
                    HStack(alignment: .top, spacing: 22) {
                        ranking(data.country, title: "国家 / 地区", key: "country", count: 3)
                        ranking(data.language, title: "语言", key: "language", count: 3)
                    }
                    if !data.city.isEmpty { Divider(); ranking(data.city, title: "城市", key: "city", count: 2) }
                } else {
                    HStack(alignment: .top, spacing: 18) {
                        VStack(alignment: .leading, spacing: 8) { metrics(data); trend(data) }.frame(maxWidth: .infinity)
                        Divider()
                        ranking(data.country, title: "国家 / 地区", key: "country", count: 3).frame(maxWidth: .infinity)
                    }
                }
                Spacer(minLength: 0)
                HStack(spacing: 4) {
                    if let date = entry.snapshot?.generatedDate { Text(date, style: .time) }
                    if entry.offline || entry.snapshot?.stale == true { Text("· 上次数据") }
                    Spacer(minLength: 0)
                }.font(.system(size: 9)).foregroundStyle(.secondary)
            } else {
                Spacer(minLength: 0)
                Text("打开 Tidemark\n读取阅读统计")
                    .font(.system(size: 13)).foregroundStyle(.secondary).lineSpacing(5)
                Spacer(minLength: 0)
            }
        }
        .foregroundStyle(.primary)
        .widgetURL(URL(string: "tidemark://overview")!)
    }

    private func metrics(_ data: ReadingWindow) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: small ? 12 : 20) {
            VStack(alignment: .leading, spacing: 1) {
                Text(data.views, format: .number).font(.system(size: small ? 28 : 26, weight: .medium)).monospacedDigit().minimumScaleFactor(0.7)
                Text("阅读量 PV").font(.system(size: 9)).foregroundStyle(.secondary)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(data.visitors, format: .number).font(.system(size: 18, weight: .medium)).monospacedDigit().minimumScaleFactor(0.7)
                Text("访客 UV").font(.system(size: 9)).foregroundStyle(.secondary)
            }
            if large { Spacer(minLength: 0) }
        }
    }

    private func trend(_ data: ReadingWindow) -> some View {
        VStack(spacing: 3) {
            Chart(Array(data.timeseries.values.enumerated()), id: \.offset) { index, value in
                LineMark(x: .value("时间", index), y: .value("阅读量", value))
                    .foregroundStyle(Color.primary).lineStyle(StrokeStyle(lineWidth: 1.5))
            }
            .chartXAxis(.hidden).chartYAxis(.hidden)
            .chartYScale(domain: 0...max(2, data.timeseries.values.max() ?? 0))
            .frame(minHeight: 22, maxHeight: .infinity)
            .accessibilityLabel("\(entry.period.label)阅读量趋势，共\(data.views)次阅读")
            if !small, let first = data.timeseries.labels.first, let last = data.timeseries.labels.last {
                HStack { Text(String(first.prefix(5))); Spacer(); Text(String(last.prefix(5))) }
                    .font(.system(size: 8)).foregroundStyle(.secondary)
            }
        }
    }

    private func ranking(_ rows: [ReadingRank], title: String, key: String, count: Int) -> some View {
        VStack(alignment: .leading, spacing: large ? 5 : 9) {
            Text(title).font(.system(size: 10, weight: .medium)).foregroundStyle(.secondary)
            if rows.isEmpty { Text("暂无数据").font(.system(size: 10)).foregroundStyle(.secondary) }
            ForEach(Array(rows.prefix(count).enumerated()), id: \.offset) { _, row in
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(rankName(row.k, key: key)).lineLimit(1).truncationMode(.tail)
                        Spacer(minLength: 0)
                        Text(row.n, format: .number).monospacedDigit()
                    }.font(.system(size: 10))
                    GeometryReader { proxy in
                        Rectangle().fill(.primary.opacity(0.18))
                            .frame(width: proxy.size.width * min(1, max(0, Double(row.n) / Double(max(1, rows.first?.n ?? 1)))))
                    }.frame(height: 2)
                }
            }
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

func rankName(_ key: String?, key dimension: String) -> String {
    guard let key, !key.isEmpty else { return "未知" }
    let locale = Locale(identifier: "zh_CN")
    if dimension == "country" { return locale.localizedString(forRegionCode: key) ?? key }
    if dimension == "language" { return locale.localizedString(forIdentifier: key) ?? key }
    return key
}

struct ReadingWidgetContent: View {
    @Environment(\.widgetFamily) var family
    let entry: ReadingEntry
    var body: some View { ReadingStatsView(entry: entry, family: family).containerBackground(.background, for: .widget) }
}
struct ReadingWidget: Widget {
    let period: ReadingPeriod
    init() { period = .week }
    init(period: ReadingPeriod) { self.period = period }
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "top.zerolovesea.studio.reading.\(period.rawValue)", provider: ReadingProvider(period: period)) { entry in
            ReadingWidgetContent(entry: entry)
        }
        .configurationDisplayName(Text(verbatim: "阅读统计 · " + period.label))
        .description("阅读量、访客、趋势与地区分布。")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

#if !WIDGET_TEST
@main
struct TidemarkWidgets: WidgetBundle {
    var body: some Widget {
        QuickWriteWidget()
        ReadingWidget(period: .today)
        ReadingWidget(period: .day)
        ReadingWidget(period: .week)
        ReadingWidget(period: .fortnight)
        ReadingWidget(period: .month)
        ReadingWidget(period: .halfYear)
    }
}
#endif
