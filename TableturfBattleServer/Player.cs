using System.Diagnostics.CodeAnalysis;

using Newtonsoft.Json;

namespace TableturfBattleServer;
public class Player {
	[JsonProperty("name")]
	public string Name { get; }
	[JsonIgnore]
	public Guid Token { get; }
	[JsonProperty("colour")]
	public Colour Colour { get; set; }
	[JsonProperty("specialColour")]
	public Colour SpecialColour { get; set; }
	[JsonProperty("specialAccentColour")]
	public Colour SpecialAccentColour { get; set; }
	[JsonProperty("specialPoints")]
	public int SpecialPoints { get; set; }

	[JsonProperty("totalSpecialPoints")]
	public int TotalSpecialPoints { get; set; }
	[JsonProperty("passes")]
	public int Passes { get; set; }

	[JsonProperty("isReady")]
	public bool IsReady => this.Move != null || (this.Deck != null && this.Hand == null);

	[JsonIgnore]
	internal Card[]? Deck;
	[JsonIgnore]
	internal readonly List<int> CardsUsed = new(12);
	[JsonIgnore]
	internal Card[]? Hand;
	[JsonIgnore]
	internal Move? Move;
	[JsonIgnore]
	internal int[]? drawOrder;

	public Player(string name, Guid token) {
		this.Name = name ?? throw new ArgumentNullException(nameof(name));
		this.Token = token;
	}

	[MemberNotNull(nameof(drawOrder))]
	internal void Shuffle(Random random) {
		this.drawOrder = new int[15];
		for (int i = 0; i < 15; i++) this.drawOrder[i] = i;
		for (int i = 14; i > 0; i--) {
			var j = random.Next(i);
			(this.drawOrder[i], this.drawOrder[j]) = (this.drawOrder[j], this.drawOrder[i]);
		}
		if (this.Deck != null) {
			this.Hand = new Card[4];
			for (int i = 0; i < 4; i++) {
				this.Hand[i] = this.Deck[this.drawOrder[i]];
			}
		}
	}

	internal int GetHandIndex(int cardNumber) {
		if (this.Hand != null) {
			for (int i = 0; i < 4; i++) {
				if (this.Hand[i].Number == cardNumber) return i;
			}
		}
		return -1;
	}
}
