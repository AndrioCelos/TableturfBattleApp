using System.Collections.ObjectModel;

using Newtonsoft.Json;

namespace TableturfBattleServer;
internal class StageDatabase {
	private const Space E = Space.Empty;
	private const Space o = Space.OutOfBounds;

	private static readonly Stage[] stages = new Stage[] {
		new("Main Street", new Space[9, 26], new[] {
			new Point[] { new(4, 22), new(4, 3), new(4, 13) },
			new Point[] { new(2, 22), new(6, 3), new(6, 22), new(2, 3) }
		}),
		new("Thunder Point", new Space[,] {
			{ o, o, o, o, o, o, o, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ o, o, o, o, o, o, o, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ o, o, o, o, o, o, o, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ o, o, o, o, o, o, o, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ o, o, o, o, o, o, o, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ o, o, o, o, o, o, o, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ o, o, o, o, o, o, o, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ o, o, o, o, o, o, o, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, o, o, o, o, o, o, o },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, o, o, o, o, o, o, o },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, o, o, o, o, o, o, o },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, o, o, o, o, o, o, o },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, o, o, o, o, o, o, o },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, o, o, o, o, o, o, o },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, o, o, o, o, o, o, o },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, o, o, o, o, o, o, o },
		}, new[] {
			new Point[] { new(3, 18), new(12, 3), new(7, 11) },
			new Point[] { new(3, 18), new(12, 3), new(12, 11), new(3, 10) },
		}),
		new("X Marks the Garden", new Space[,] {
			{ o, o, o, o, o, o, o, o, E, E, E, E, E, E, E, o, o, o, o, o, o, o, o },
			{ o, o, o, o, o, o, o, o, E, E, E, E, E, E, E, o, o, o, o, o, o, o, o },
			{ o, o, o, o, o, o, o, o, E, E, E, E, E, E, E, o, o, o, o, o, o, o, o },
			{ o, o, o, o, o, o, o, o, E, E, E, E, E, E, E, o, o, o, o, o, o, o, o },
			{ o, o, o, o, o, o, o, o, E, E, E, E, E, E, E, o, o, o, o, o, o, o, o },
			{ o, o, o, o, o, o, o, o, E, E, E, E, E, E, E, o, o, o, o, o, o, o, o },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ o, o, o, o, o, o, o, o, E, E, E, E, E, E, E, o, o, o, o, o, o, o, o },
			{ o, o, o, o, o, o, o, o, E, E, E, E, E, E, E, o, o, o, o, o, o, o, o },
			{ o, o, o, o, o, o, o, o, E, E, E, E, E, E, E, o, o, o, o, o, o, o, o },
			{ o, o, o, o, o, o, o, o, E, E, E, E, E, E, E, o, o, o, o, o, o, o, o },
			{ o, o, o, o, o, o, o, o, E, E, E, E, E, E, E, o, o, o, o, o, o, o, o },
			{ o, o, o, o, o, o, o, o, E, E, E, E, E, E, E, o, o, o, o, o, o, o, o },
		}, new[] { new Point[] { new(9, 19), new(x: 9, 3), new(15, 11), new(3, 11) } }),
		new("Square Squared", new Space[15, 15], new[] { new Point[] { new(3, 11), new(11, 3), new(11, 11), new(3, 3) }}),
		new("Lakefront Property", new Space[,] {
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, },
			{ E, E, E, E, E, E, o, o, o, o, E, E, E, E, E, E, },
			{ E, E, E, E, E, E, o, o, o, o, E, E, E, E, E, E, },
			{ E, E, E, E, E, E, o, o, o, o, E, E, E, E, E, E, },
			{ E, E, E, E, E, E, o, o, o, o, E, E, E, E, E, E, },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, },
		}, new[] { new Point[] { new(3, 12), new(12, 3), new(12, 12), new(3, 3) }}),
		new("Double Gemini", new Space[,] {
			{ o, o, o, o, o, o, o, o, E, o, o, o, o, o, o, o, E, o, o, o, o, o, o, o, o },
			{ o, o, o, o, o, o, o, E, E, E, o, o, o, o, o, E, E, E, o, o, o, o, o, o, o },
			{ o, o, o, o, o, o, E, E, E, E, E, o, o, o, E, E, E, E, E, o, o, o, o, o, o },
			{ o, o, o, o, o, E, E, E, E, E, E, E, o, E, E, E, E, E, E, E, o, o, o, o, o },
			{ o, o, o, o, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, o, o, o, o },
			{ o, o, o, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, o, o, o },
			{ o, o, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, o, o },
			{ o, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, o },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ o, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, o },
			{ o, o, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, o, o },
			{ o, o, o, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, o, o, o },
			{ o, o, o, o, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, o, o, o, o },
			{ o, o, o, o, o, E, E, E, E, E, E, E, o, E, E, E, E, E, E, E, o, o, o, o, o },
			{ o, o, o, o, o, o, E, E, E, E, E, o, o, o, E, E, E, E, E, o, o, o, o, o, o },
			{ o, o, o, o, o, o, o, E, E, E, o, o, o, o, o, E, E, E, o, o, o, o, o, o, o },
			{ o, o, o, o, o, o, o, o, E, o, o, o, o, o, o, o, E, o, o, o, o, o, o, o, o },
		}, new[] {
			new Point[] { new(8, 19), new(8, 5), new(8, 12) },
			new Point[] { new(5, 16), new(11, 8), new(11, 16), new(5, 8) }
		}),
		new("River Drift", new Space[,] {
			{ o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, E, E, E, E, E, E, E },
			{ o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, E, E, E, E, E, E, E },
			{ o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, E, E, E, E, E, E, E },
			{ o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, E, E, E, E, E, E, E },
			{ o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o },
			{ E, E, E, E, E, E, E, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o },
			{ E, E, E, E, E, E, E, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o },
			{ E, E, E, E, E, E, E, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o },
			{ E, E, E, E, E, E, E, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o },
		}, new[] {
			new Point[] { new(3, 21), new(13, 3), new(8, 12) },
			new Point[] { new(3, 21), new(13, 3), new(8, 16), new(8, 8) }
		}),
		new("Box Seats", new Space[10, 10], new[] { new Point[] { new(2, 7), new(7, 2), new(7, 7), new(2, 2) }}),
	};

	public static Version Version { get; } = new(1, 2, 0, 1);
	public static DateTime LastModified { get; } = new(2023, 4, 12, 23, 0, 0, DateTimeKind.Utc);
	public static string JSON { get; }
	public static ReadOnlyCollection<Stage> Stages { get; }

	static StageDatabase() {
		Stages = Array.AsReadOnly(stages);
		JSON = JsonUtils.Serialise(stages);
	}
}
