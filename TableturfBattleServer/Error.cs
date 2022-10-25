using Newtonsoft.Json;

namespace TableturfBattleServer;
public struct Error {
	[JsonProperty("code")]
	public string Code { get; }
	[JsonProperty("description")]
	public string Description { get; }

	public Error(string code, string description) {
		this.Code = code ?? throw new ArgumentNullException(nameof(code));
		this.Description = description ?? throw new ArgumentNullException(nameof(description));
	}
}
