using System.ComponentModel;

using Newtonsoft.Json;

namespace TableturfBattleServer;
public class Move {
	[JsonProperty("card")]
	public Card Card { get; }
	[JsonProperty("isPass")]
	public bool IsPass { get; }
	[JsonProperty("x")]
	public int X { get; }
	[JsonProperty("y")]
	public int Y { get; }
	[JsonProperty("rotation")]
	public int Rotation { get; }
	[JsonProperty("isSpecialAttack")]
	public bool IsSpecialAttack { get; }
	[JsonProperty("isTimeout")]
	public bool IsTimeout { get; }

	public Move(Card card, bool isPass, int x, int y, int rotation, bool isSpecialAttack, bool isTimeout) {
		this.Card = card ?? throw new ArgumentNullException(nameof(card));
		this.IsPass = isPass;
		this.X = x;
		this.Y = y;
		this.Rotation = rotation;
		this.IsSpecialAttack = isSpecialAttack;
		this.IsTimeout = isTimeout;
	}

	[EditorBrowsable(EditorBrowsableState.Never)]
	public bool ShouldSerializeX() => !this.IsPass;
	[EditorBrowsable(EditorBrowsableState.Never)]
	public bool ShouldSerializeY() => !this.IsPass;
	[EditorBrowsable(EditorBrowsableState.Never)]
	public bool ShouldSerializeRotation() => !this.IsPass;
	[EditorBrowsable(EditorBrowsableState.Never)]
	public bool ShouldSerializeIsSpecialAttack() => !this.IsPass;
}
