using System.ComponentModel;

namespace TableturfBattleServer;
public class Move(Card card, bool isPass, int x, int y, int rotation, bool isSpecialAttack, bool isTimeout) {
	public Card Card { get; } = card ?? throw new ArgumentNullException(nameof(card));
	public bool IsPass { get; } = isPass;
	public int X { get; } = x;
	public int Y { get; } = y;
	public int Rotation { get; } = rotation;
	public bool IsSpecialAttack { get; } = isSpecialAttack;
	public bool IsTimeout { get; } = isTimeout;

	[EditorBrowsable(EditorBrowsableState.Never)]
	public bool ShouldSerializeX() => !this.IsPass;
	[EditorBrowsable(EditorBrowsableState.Never)]
	public bool ShouldSerializeY() => !this.IsPass;
	[EditorBrowsable(EditorBrowsableState.Never)]
	public bool ShouldSerializeRotation() => !this.IsPass;
	[EditorBrowsable(EditorBrowsableState.Never)]
	public bool ShouldSerializeIsSpecialAttack() => !this.IsPass;
}
