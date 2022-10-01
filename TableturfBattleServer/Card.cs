using Newtonsoft.Json;

namespace TableturfBattleServer;
public class Card {
	[JsonProperty("number")]
	public int Number { get; }
	[JsonProperty("name")]
	public string Name { get; }
	[JsonProperty("rarity")]
	public Rarity Rarity { get; }
	[JsonProperty("specialCost")]
	public int SpecialCost { get; }
	[JsonIgnore]
	public int Size { get; }

	[JsonProperty("grid")]
	private readonly Space[,] grid;

	internal Card(int number, string name, Rarity rarity, int specialCost, Space[,] grid) {
		this.Number = number;
		this.Name = name ?? throw new ArgumentNullException(nameof(name));
		this.Rarity = rarity;
		this.SpecialCost = specialCost;
		this.grid = grid ?? throw new ArgumentNullException(nameof(grid));

		var size = 0;
		if (grid.GetUpperBound(0) != 7 || grid.GetUpperBound(1) != 7)
			throw new ArgumentException("Grid must be 8 × 8.", nameof(grid));
		for (int y = 0; y < 8; y++) {
			for (int x = 0; x < 8; x++) {
				switch (grid[x, y]) {
					case Space.Empty:
						break;
					case Space.Ink1:
					case Space.SpecialInactive1:
						size++;
						break;
					default:
						throw new ArgumentException("Grid contains invalid values.", nameof(grid));
				}
			}
		}
		this.Size = size;
	}

	/// <summary>Returns the space in the specified position on the card grid when rotated in the specified manner.</summary>
	/// <param name="x">The number of spaces right from the top left corner.</param>
	/// <param name="y">The number of spaces down from the top left corner.</param>
	/// <param name="rotation">The number of clockwise rotations.</param>
	public Space GetSpace(int x, int y, int rotation) {
		if (x is < 0 or >= 8)
			throw new ArgumentOutOfRangeException(nameof(x));
		if (y is < 0 or >= 8)
			throw new ArgumentOutOfRangeException(nameof(y));
		return (rotation & 3) switch {
			0 => this.grid[x, y],
			1 => this.grid[y, 7 - x],
			2 => this.grid[7 - x, 7 - y],
			_ => this.grid[7 - y, x],
		};
	}
}
