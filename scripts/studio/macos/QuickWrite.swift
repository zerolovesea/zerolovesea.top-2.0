import Foundation

enum QuickWriteKind: String, CaseIterable {
    case thought, writing

    var url: URL { URL(string: "tidemark://new/\(rawValue)")! }
    var title: String { self == .thought ? "写随笔" : "写博文" }
    var symbol: String { self == .thought ? "square.and.pencil" : "doc.badge.plus" }

    init?(url: URL) {
        guard url.scheme == "tidemark", url.host == "new", url.user == nil, url.password == nil,
              url.port == nil, url.query == nil, url.fragment == nil,
              let value = Self(rawValue: String(url.path.dropFirst())), url.path == "/\(value.rawValue)" else { return nil }
        self = value
    }
}
