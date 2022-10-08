using Newtonsoft.Json;

namespace TableturfBattleServer;
public class Stage {
	[JsonProperty("name")]
	public string Name { get; }
	[JsonProperty("grid")]
	internal readonly Space[,] grid;
	/// <summary>
	///		The lists of starting spaces on this stage.
	/// </summary>
	/// <remarks>
	///		The smallest list with at least as many spaces as players in the game will be used.
	///		For example, if there is a list of 3 and a list of 4, the list of 3 will be used for 2 or 3 players, and the list of 4 will be used for 4 players.
	/// </remarks>
	[JsonProperty("startSpaces")]
	internal readonly Point[][] startSpaces;

	public Stage(string name, Space[,] grid, Point[][] startSpaces) {
		this.Name = name ?? throw new ArgumentNullException(nameof(name));
		this.grid = grid ?? throw new ArgumentNullException(nameof(grid));
		this.startSpaces = startSpaces ?? throw new ArgumentNullException(nameof(startSpaces));
	}
}
