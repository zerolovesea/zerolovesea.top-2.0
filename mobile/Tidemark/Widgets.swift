import SwiftUI
import WidgetKit
import Charts

struct Entry: TimelineEntry {
    let date: Date
    let period: Period
    let data: Overview?
    let offline: Bool
}
struct Provider: TimelineProvider {
    let period: Period
    func placeholder(in context: Context) -> Entry { Entry(date:.now,period:period,data:nil,offline:false) }
    func getSnapshot(in context: Context,completion:@escaping (Entry)->Void) { completion(Entry(date:.now,period:period,data:Reader.cached(period),offline:true)) }
    func getTimeline(in context: Context,completion:@escaping (Timeline<Entry>)->Void) {
        Task {
            let data: Overview?
            let offline: Bool
            do { data=try await Reader.fetch(period);offline=false }
            catch { data=Reader.cached(period);offline=true }
            completion(Timeline(entries:[Entry(date:.now,period:period,data:data,offline:offline)],policy:.after(.now.addingTimeInterval(15*60))))
        }
    }
}
struct StatsWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: Entry
    var body: some View {
        VStack(alignment:.leading,spacing:family == .systemLarge ? 10 : 4) {
            HStack {
                Image("Logo").renderingMode(.template).resizable().scaledToFit().frame(width:16,height:16)
                Text("阅读概览").font(.caption).bold()
                Spacer()
                Text(entry.period.label).font(.caption2).foregroundStyle(.secondary)
            }
            if let data=entry.data {
                HStack(alignment:.firstTextBaseline,spacing:20) {
                    VStack(alignment:.leading,spacing:0) { Text(data.views.formatted()).font(.system(size:32,weight:.medium));Text("PV").font(.caption2).foregroundStyle(.secondary) }
                    VStack(alignment:.leading,spacing:0) { Text(data.visitors.formatted()).font(.title2);Text("UV").font(.caption2).foregroundStyle(.secondary) }
                }.monospacedDigit()
                Chart(Array(data.series.enumerated()),id:\.offset) { i,row in
                    LineMark(x:.value("时段",i),y:.value("PV",row.views)).foregroundStyle(.primary)
                }
                .chartYScale(domain:0...max(1,data.series.map(\.views).max() ?? 0))
                .chartXAxis(.hidden).chartYAxis(.hidden)
                // A maximum height lets the widget compress the plot to a few pixels.
                .frame(height:family == .systemLarge ? 70 : family == .systemSmall ? 28 : 32)
                .accessibilityLabel("阅读趋势，最高每时段 \(data.series.map(\.views).max() ?? 0) 次")
                if family != .systemSmall {
                    HStack {
                        ForEach(Array(data.countries.prefix(3))) { rank in
                            VStack(alignment:.leading,spacing:0) {
                                Text(Locale(identifier:"zh_CN").localizedString(forRegionCode:rank.name) ?? rank.name).lineLimit(1)
                                Text(rank.count.formatted()).foregroundStyle(.secondary)
                            }.frame(maxWidth:.infinity,alignment:.leading)
                        }
                    }.font(.caption2)
                }
                if family == .systemLarge {
                    Divider()
                    ForEach(Array(data.cities.prefix(3))) { rank in HStack { Text(rank.name);Spacer();Text(rank.count.formatted()) }.font(.caption) }
                }
                Spacer(minLength:0)
                if family != .systemMedium,let date=data.date { Text((entry.offline ? "上次数据 · " : "")+date.formatted(date:.omitted,time:.shortened)).font(.system(size:9)).foregroundStyle(.secondary) }
            } else {
                Text("点按打开 Tidemark 刷新统计").font(.caption).foregroundStyle(.secondary)
                Spacer()
            }
        }.widgetURL(URL(string:"tidemark://overview"))
    }
}
struct ReadingWidget: Widget {
    let period: Period
    init() { period = .today }
    init(period: Period) { self.period = period }
    var body: some WidgetConfiguration {
        StaticConfiguration(kind:"top.zerolovesea.tidemark.reader."+period.rawValue,provider:Provider(period:period)) { entry in
            StatsWidgetView(entry:entry).containerBackground(.background,for:.widget)
        }.configurationDisplayName(Text(verbatim:"阅读统计 · "+period.label))
            .description("近期阅读量、独立访客与地区。")
            .supportedFamilies([.systemSmall,.systemMedium,.systemLarge])
    }
}
@main struct TidemarkWidgets: WidgetBundle {
    var body: some Widget {
        ReadingWidget(period:.today)
        ReadingWidget(period:.day)
        ReadingWidget(period:.week)
        ReadingWidget(period:.fortnight)
        ReadingWidget(period:.month)
        ReadingWidget(period:.halfYear)
    }
}
