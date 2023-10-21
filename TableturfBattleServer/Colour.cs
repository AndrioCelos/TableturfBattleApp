namespace TableturfBattleServer;
public struct Colour {
	public int R;
	public int G;
	public int B;

	public Colour(int r, int g, int b) {
		this.R = r;
		this.G = g;
		this.B = b;
	}

	public Colour(int packed) {
		this.R = packed >> 16 & byte.MaxValue;
		this.G = packed >> 8 & byte.MaxValue;
		this.B = packed & byte.MaxValue;
	}
}
