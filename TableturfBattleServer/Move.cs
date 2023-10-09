using System.ComponentModel;

namespace TableturfBattleServer;
public class Move {
	public Card Card { get; }
	public bool IsPass { get; }
	public int X { get; }
	public int Y { get; }
	public int Rotation { get; }
	public bool IsSpecialAttack { get; }
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
