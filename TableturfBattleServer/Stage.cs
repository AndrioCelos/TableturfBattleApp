using Newtonsoft.Json;

namespace TableturfBattleServer;
public class Stage(string name, Space[,] grid, Point[][] startSpaces) {
	public string Name { get; } = name ?? throw new ArgumentNullException(nameof(name));
	[JsonProperty]
	internal Space[,] Grid = grid ?? throw new ArgumentNullException(nameof(grid));
	/// <summary>
	///		The lists of starting spaces on this stage.
	/// </summary>
	/// <remarks>
	///		The smallest list with at least as many spaces as players in the game will be used.
	///		For example, if there is a list of 3 and a list of 4, the list of 3 will be used for 2 or 3 players, and the list of 4 will be used for 4 players.
	/// </remarks>
	[JsonProperty]
	internal Point[][] StartSpaces = startSpaces ?? throw new ArgumentNullException(nameof(startSpaces));

	[JsonIgnore]
	public int MaxPlayers => this.StartSpaces.Max(a => a.Length);
}
