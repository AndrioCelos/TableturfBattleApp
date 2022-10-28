using System.Net;

using Newtonsoft.Json;

namespace TableturfBattleServer;
public struct Error {
	[JsonIgnore]
	public HttpStatusCode HttpStatusCode { get; }
	[JsonProperty("code")]
	public string Code { get; }
	[JsonProperty("description")]
	public string Description { get; }

	public Error(HttpStatusCode httpStatusCode, string code, string description) {
		this.HttpStatusCode = httpStatusCode;
		this.Code = code ?? throw new ArgumentNullException(nameof(code));
		this.Description = description ?? throw new ArgumentNullException(nameof(description));
	}
}
