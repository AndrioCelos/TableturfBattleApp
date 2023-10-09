using Newtonsoft.Json;

namespace TableturfBattleServer;
public class Deck : IEquatable<Deck> {
	[JsonProperty]
	internal string Name;
	[JsonProperty]
	internal int Sleeves;
	[JsonProperty]
	internal Card[] Cards;
	[JsonProperty]
	internal int[] Upgrades;

	public Deck(string name, int sleeves, Card[] cards, int[] levels) {
		this.Name = name ?? throw new ArgumentNullException(nameof(name));
		this.Sleeves = sleeves;
		this.Cards = cards ?? throw new ArgumentNullException(nameof(cards));
		this.Upgrades = levels ?? throw new ArgumentNullException(nameof(levels));
	}

	public bool Equals(Deck? other)
		=> other is not null && this.Name == other.Name && this.Sleeves == other.Sleeves && this.Cards.SequenceEqual(other.Cards) && this.Upgrades.SequenceEqual(other.Upgrades);
	public override bool Equals(object? other) => other is Deck deck && this.Equals(deck);

	public override int GetHashCode() {
		var hashCode = new HashCode();
		hashCode.Add(this.Name);
		hashCode.Add(this.Sleeves);
		foreach (var card in this.Cards)
			hashCode.Add(card.Number);
		foreach (var n in this.Upgrades)
			hashCode.Add(n);
		return hashCode.ToHashCode();
	}
}
