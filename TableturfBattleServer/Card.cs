using Newtonsoft.Json;

namespace TableturfBattleServer;
public class Card {
	public int Number { get; }
	public int? AltNumber { get; init; }
	public string Name { get; }
	public Rarity Rarity { get; }
	public int SpecialCost { get; }
	[JsonIgnore]
	public int Size { get; }
	public int? IsVariantOf { get; init; }

	public string Line1 { get; init; }
	public string? Line2 { get; init; }
	public string? ArtFileName { get; init; }
	public Colour? InkColour1 { get; init; }
	public Colour? InkColour2 { get; init; }

	[JsonProperty]
	private readonly Space[,] grid;

	internal Card(int number, string name, Rarity rarity, string? artFileName, Space[,] grid) : this(number, null, name, rarity, null, artFileName, grid) { }
	internal Card(int number, int? altNumber, string name, Rarity rarity, string? artFileName, Space[,] grid) : this(number, altNumber, name, rarity, null, artFileName, grid) { }
	internal Card(int number, string name, Rarity rarity, int? specialCost, string? artFileName, Space[,] grid) : this(number, null, name, rarity, specialCost, artFileName, grid) { }
	internal Card(int number, int? altNumber, string name, Rarity rarity, int? specialCost, string? artFileName, Space[,] grid) {
		this.Number = number;
		this.AltNumber = altNumber;
		this.Rarity = rarity;
		this.ArtFileName = artFileName;
		this.grid = grid ?? throw new ArgumentNullException(nameof(grid));

		var pos = (name ?? throw new ArgumentNullException(nameof(name))).IndexOf('\n');
		if (pos < 0) {
			this.Name = name;
			this.Line1 = name;
		} else {
			this.Name = name[pos - 1] == '-' ? name.Remove(pos, 1) : name.Replace('\n', ' ');
			this.Line1 = name[0..pos];
			this.Line2 = name[(pos + 1)..];
		}

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

		this.SpecialCost = specialCost ?? size switch { <= 3 => 1, <= 5 => 2, <= 8 => 3, <= 11 => 4, <= 15 => 5, _ => 6 };
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
