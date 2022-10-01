using Newtonsoft.Json;

namespace TableturfBattleServer;
public struct Point {
	[JsonProperty("x")]
	public int X;
	[JsonProperty("y")]
	public int Y;

	public Point(int x, int y) {
		this.X = x;
		this.Y = y;
	}
}
