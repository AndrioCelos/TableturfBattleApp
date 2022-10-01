using Newtonsoft.Json;

namespace TableturfBattleServer;
public struct Colour {
	[JsonProperty("r")]
	public int R;
	[JsonProperty("g")]
	public int G;
	[JsonProperty("b")]
	public int B;

	public Colour(int r, int g, int b) {
		this.R = r;
		this.G = g;
		this.B = b;
	}
}
