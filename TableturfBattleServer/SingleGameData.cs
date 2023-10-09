using Newtonsoft.Json;

namespace TableturfBattleServer;
public class SingleGameData {
	public int SpecialPoints { get; set; }
	public int TotalSpecialPoints { get; set; }
	public int Passes { get; set; }

	[JsonIgnore]
	internal bool won = false;

	[JsonIgnore]
	internal List<ReplayTurn> turns = new(12);

	[JsonIgnore]
	internal Deck? Deck;
	[JsonIgnore]
	internal int[]? initialDrawOrder;
	[JsonIgnore]
	internal int[]? drawOrder;
}
