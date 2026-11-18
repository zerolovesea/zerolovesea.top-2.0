import SwiftUI
import Charts
import SafariServices
import WidgetKit

@main struct TidemarkApp: App {
    var body: some Scene { WindowGroup { RootView() } }
}
struct RootView: View {
    @State private var tab=0
    var body: some View {
        TabView(selection:$tab) {
            OverviewView().tabItem { Label("阅读概览",systemImage:"chart.xyaxis.line") }.tag(0)
            BlogView().tabItem { Label("博客",systemImage:"text.book.closed") }.tag(1)
            SettingsView().tabItem { Label("设置",systemImage:"gearshape") }.tag(2)
        }
        .tint(.primary)
        .onOpenURL { url in if url.scheme=="tidemark" { tab=0 } }
    }
}
struct SettingsView: View {
    var body: some View {
        NavigationStack {
            Form {
                Section("Tidemark") {
                LabeledContent("版本",value:"1.0.2")
                    Link("打开博客",destination:URL(string:"https://zerolovesea.top")!)
                }
                Section {
                    Text("小组件显示最近一次成功更新的统计，刷新由 iOS 调度。")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }.navigationTitle("设置")
        }
    }
}
struct OverviewView: View {
    @Environment(\.scenePhase) private var phase
    @State private var period=Period.week
    @State private var data: Overview?
    @State private var error=""
    @State private var loading=false
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment:.leading,spacing:24) {
                    Picker("时间段",selection:$period) { ForEach(Period.allCases) { Text($0.label).tag($0) } }
                        .pickerStyle(.menu)
                    if let data {
                        HStack(spacing:0) {
                            metric("阅读量 PV",data.views)
                            Divider()
                            metric("独立访客 UV",data.visitors)
                        }.frame(height:82)
                        Chart(Array(data.series.enumerated()),id:\.offset) { i,point in
                            LineMark(x:.value("时段",i),y:.value("PV",point.views)).foregroundStyle(.primary)
                            PointMark(x:.value("时段",i),y:.value("PV",point.views)).foregroundStyle(.primary).symbolSize(12)
                        }.chartXAxis(.hidden).frame(height:170).accessibilityLabel("阅读趋势")
                        HStack {
                            Text(data.series.first?.time.prefix(10) ?? "")
                            Spacer()
                            Text(data.series.last?.time.prefix(10) ?? "")
                        }.font(.caption).foregroundStyle(.secondary)
                        ranking("国家 / 地区",data.countries,region:true)
                        ranking("城市",data.cities)
                        ranking("语言",data.languages)
                        ranking("热门文章",data.posts)
                        if let date=data.date { Text("更新于 "+date.formatted(date:.abbreviated,time:.shortened)).font(.caption).foregroundStyle(.secondary) }
                    } else if loading { ProgressView("读取统计…").frame(maxWidth:.infinity) }
                    if !error.isEmpty {
                        ContentUnavailableView(error,systemImage:"wifi.exclamationmark",description:Text("请检查网络连接，或稍后下拉刷新。"))
                    }
                }.padding(20)
            }
            .navigationTitle("阅读概览")
            .toolbar { Button { Task { await load() } } label: { Image(systemName:"arrow.clockwise") }.disabled(loading) }
            .refreshable { await load() }
            .task(id:period) { await load() }
            .onChange(of:phase) { _,value in if value == .active { Task { await load() } } }
        }
    }
    private func metric(_ label: String,_ value: Int) -> some View {
        VStack(alignment:.leading,spacing:8) { Text(label).font(.caption).foregroundStyle(.secondary);Text(value.formatted()).font(.system(size:36,weight:.medium)).monospacedDigit() }.frame(maxWidth:.infinity,alignment:.leading)
    }
    private func ranking(_ title: String,_ rows: [Rank],region: Bool=false) -> some View {
        VStack(alignment:.leading,spacing:12) {
            Divider()
            Text(title).font(.headline)
            if rows.isEmpty { Text("暂无数据").foregroundStyle(.secondary) }
            ForEach(rows) { row in
                HStack { Text(region ? Locale(identifier:"zh_CN").localizedString(forRegionCode:row.name) ?? row.name : row.name).lineLimit(2);Spacer();Text(row.count.formatted()).monospacedDigit().foregroundStyle(.secondary) }.font(.subheadline)
            }
        }
    }
    @MainActor private func load() async {
        let selected=period
        data=Reader.cached(selected)
        loading=true;error=""
        do {
            let result=try await Reader.fetch(selected)
            guard period==selected,!Task.isCancelled else { return }
            data=result
            WidgetCenter.shared.reloadAllTimelines()
        } catch {
            guard period==selected,!Task.isCancelled else { return }
            self.error=data == nil ? "暂时无法读取统计" : "更新失败，显示上次数据"
        }
        loading=false
    }
}
struct Article: Identifiable {
    var title="",link="",description="",date=""
    var id: String { link }
}
final class FeedParser: NSObject, XMLParserDelegate {
    var articles=[Article]()
    private var item: Article?
    private var field=""
    private var text=""
    func parser(_ parser: XMLParser,didStartElement name:String,namespaceURI:String?,qualifiedName:String?,attributes:[String:String]) {
        field=name;text=""
        if name=="item" { item=Article() }
    }
    func parser(_ parser: XMLParser,foundCharacters string:String) { text+=string }
    func parser(_ parser: XMLParser,didEndElement name:String,namespaceURI:String?,qualifiedName:String?) {
        guard item != nil else { return }
        switch name {
        case "title":item?.title=text
        case "link":item?.link=text
        case "description":item?.description=text
        case "pubDate":item?.date=text
        case "item":
            if let item,let url=URL(string:item.link),url.scheme=="https",url.host=="zerolovesea.top" { articles.append(item) }
            item=nil
        default:break
        }
    }
}
struct BlogView: View {
    @State private var articles=[Article]()
    @State private var query=""
    @State private var error=""
    @State private var selected: Article?
    var body: some View {
        NavigationStack {
            List {
                if !error.isEmpty { Text(error).foregroundStyle(.secondary) }
                ForEach(articles.filter { query.isEmpty || $0.title.localizedCaseInsensitiveContains(query) || $0.description.localizedCaseInsensitiveContains(query) }) { article in
                    Button { selected=article } label: {
                        VStack(alignment:.leading,spacing:8) {
                            Text(article.title).font(.headline).foregroundStyle(.primary)
                            Text(article.description).font(.subheadline).foregroundStyle(.secondary).lineLimit(3)
                        }.padding(.vertical,6)
                    }
                }
            }
            .listStyle(.plain).navigationTitle("博客").searchable(text:$query,prompt:"搜索文章和随想")
            .task { await load() }.refreshable { await load() }
            .sheet(item:$selected) { article in if let url=URL(string:article.link) { SafariReader(url:url).ignoresSafeArea() } }
        }
    }
    @MainActor private func load() async {
        do {
            let (data,response)=try await URLSession.shared.data(from:URL(string:"https://zerolovesea.top/rss.xml")!)
            guard (response as? HTTPURLResponse)?.statusCode==200 else { throw URLError(.badServerResponse) }
            let delegate=FeedParser(),parser=XMLParser(data:data)
            parser.delegate=delegate
            guard parser.parse() else { throw URLError(.cannotParseResponse) }
            articles=delegate.articles;error=""
        } catch { self.error="博客暂时无法加载，下拉重试。" }
    }
}
struct SafariReader: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context:Context) -> SFSafariViewController { SFSafariViewController(url:url) }
    func updateUIViewController(_ controller:SFSafariViewController,context:Context) {}
}
