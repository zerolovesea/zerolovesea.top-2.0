import Foundation
import WidgetKit

enum Period: String, CaseIterable, Identifiable {
    case today, day, week, fortnight, month, halfYear
    var id: String { rawValue }
    var label: String {
        switch self {
        case .today: "今天"
        case .day: "近24小时"
        case .week: "近7天"
        case .fortnight: "近15天"
        case .month: "近30天"
        case .halfYear: "近半年"
        }
    }
}
struct ReadingPoint: Codable, Identifiable {
    let time: String
    let views: Int
    let visitors: Int
    var id: String { time }
}
struct Rank: Codable, Identifiable {
    let name: String
    let count: Int
    var id: String { name }
}
struct Overview: Codable {
    let generatedAt: String
    let period: String
    let views: Int
    let visitors: Int
    let series: [ReadingPoint]
    let countries: [Rank]
    let cities: [Rank]
    let languages: [Rank]
    let posts: [Rank]
    var date: Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime,.withFractionalSeconds]
        return formatter.date(from: generatedAt)
    }
}
enum Reader {
    static let group = "group.top.zerolovesea.tidemark.reader"
    static var directory: URL? { FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) }
    static func cached(_ period: Period) -> Overview? {
        guard let url=directory?.appendingPathComponent(period.rawValue+".json"),let data=try? Data(contentsOf:url) else { return nil }
        return try? JSONDecoder().decode(Overview.self,from:data)
    }
    static func fetch(_ period: Period) async throws -> Overview {
        var request=URLRequest(url:URL(string:"https://zerolovesea.top/api/mobile/overview?period="+period.rawValue)!)
        request.timeoutInterval=20
        let (data,response)=try await URLSession.shared.data(for:request)
        guard let http=response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        guard http.statusCode==200 else {
            throw URLError(.badServerResponse)
        }
        let value=try JSONDecoder().decode(Overview.self,from:data)
        guard value.period==period.rawValue,value.date != nil else { throw URLError(.cannotParseResponse) }
        if let url=directory?.appendingPathComponent(period.rawValue+".json") {
            try data.write(to:url,options:[.atomic,.completeFileProtectionUntilFirstUserAuthentication])
        }
        return value
    }
}
