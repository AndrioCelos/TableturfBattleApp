using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;

namespace TableturfBattleServer;
internal class JsonUtils {
	private static readonly JsonSerializerSettings serializerSettings = new() { ContractResolver = new CamelCasePropertyNamesContractResolver() };

	internal static string Serialise(object? o) => JsonConvert.SerializeObject(o, serializerSettings);
}
