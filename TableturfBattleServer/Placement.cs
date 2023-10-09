using Newtonsoft.Json;

namespace TableturfBattleServer;
public class Placement {
	public List<int> Players { get; } = new();
	[JsonConverter(typeof(SpacesAffectedDictionaryConverter))]
	public Dictionary<Point, Space> SpacesAffected { get; } = new();

	internal class SpacesAffectedDictionaryConverter : JsonConverter<Dictionary<Point, Space>> {
		public override Dictionary<Point, Space>? ReadJson(JsonReader reader, Type objectType, Dictionary<Point, Space>? existingValue, bool hasExistingValue, JsonSerializer serializer) {
			var list = serializer.Deserialize<List<(Point space, Space newState)>>(reader);
			return list?.ToDictionary(o => o.space, o => o.newState);
		}

		public override void WriteJson(JsonWriter writer, Dictionary<Point, Space>? value, JsonSerializer serializer) {
			serializer.Serialize(writer, value?.Select(e => new { space = e.Key, newState = e.Value }));
		}
	}
}
