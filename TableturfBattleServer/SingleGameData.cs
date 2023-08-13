using Newtonsoft.Json;

namespace TableturfBattleServer;
public class SingleGameData {
	[JsonProperty("specialPoints")]
	public int SpecialPoints { get; set; }

	[JsonProperty("totalSpecialPoints")]
	public int TotalSpecialPoints { get; set; }
	[JsonProperty("passes")]
	public int Passes { get; set; }

	[JsonIgnore]
	internal bool won = false;

	[JsonIgnore]
	internal List<ReplayTurn> turns = new(12);

	[JsonIgnore]
	internal Card[]? Deck;
	[JsonIgnore]
	internal int[]? initialDrawOrder;
	[JsonIgnore]
	internal int[]? drawOrder;
}
