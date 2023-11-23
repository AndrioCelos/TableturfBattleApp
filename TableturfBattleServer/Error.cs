using System.Net;
using Newtonsoft.Json;

namespace TableturfBattleServer;
public readonly struct Error(HttpStatusCode httpStatusCode, string code, string description) {
	[JsonIgnore]
	public HttpStatusCode HttpStatusCode { get; } = httpStatusCode;
	public string Code { get; } = code ?? throw new ArgumentNullException(nameof(code));
	public string Description { get; } = description ?? throw new ArgumentNullException(nameof(description));
}
