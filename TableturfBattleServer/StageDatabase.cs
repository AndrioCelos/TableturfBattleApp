using System.Collections.ObjectModel;

namespace TableturfBattleServer;
internal class StageDatabase {
	private const Space E = Space.Empty;
	private const Space W = Space.Wall;
	private const Space o = Space.OutOfBounds;
	private const Space a = Space.Ink1;
	private const Space b = Space.Ink2;
	private const Space A = Space.SpecialInactive1;
	private const Space B = Space.SpecialInactive2;

	private static readonly Stage[] stages = [
		new("Main Street", new Space[9, 26], [
			[new(4, 22), new(4, 3), new(4, 13)],
			[new(2, 22), new(6, 3), new(6, 22), new(2, 3)]
		]),
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
		}, [
			[new(3, 18), new(12, 3), new(7, 11)],
			[new(3, 18), new(12, 3), new(12, 11), new(3, 10)],
		]),
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
		}, [[new(9, 19), new(x: 9, 3), new(15, 11), new(3, 11)]]),
		new("Square Squared", new Space[15, 15], [[new(3, 11), new(11, 3), new(11, 11), new(3, 3)]]),
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
		}, [[new(3, 12), new(12, 3), new(12, 12), new(3, 3)]]),
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
		}, [
			[new(8, 19), new(8, 5), new(8, 12)],
			[new(5, 16), new(11, 8), new(11, 16), new(5, 8)]
		]),
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
		}, [
			[new(3, 21), new(13, 3), new(8, 12)],
			[new(3, 21), new(13, 3), new(8, 16), new(8, 8)]
		]),
		new("Box Seats", new Space[10, 10], [[new(2, 7), new(7, 2), new(7, 7), new(2, 2)]]),
		new("Girder for Battle", new Space[,] {
			{ E, E, E, E, E, E, o, o, o, o, o, o, E, E, E, E, E, E },
			{ E, E, E, E, E, E, o, o, o, o, o, o, E, E, E, E, E, E },
			{ E, E, E, E, E, E, o, o, o, o, o, o, E, E, E, E, E, E },
			{ E, E, E, E, E, E, o, o, o, o, o, o, E, E, E, E, E, E },
			{ E, E, E, E, E, E, o, o, o, o, o, o, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, o, o, o, o, o, o, E, E, E, E, E, E },
			{ E, E, E, E, E, E, o, o, o, o, o, o, E, E, E, E, E, E },
			{ E, E, E, E, E, E, o, o, o, o, o, o, E, E, E, E, E, E },
			{ E, E, E, E, E, E, o, o, o, o, o, o, E, E, E, E, E, E },
			{ E, E, E, E, E, E, o, o, o, o, o, o, E, E, E, E, E, E },
		}, [
			[new(8, 17), new(8, 0), new(8, 9)],
			[new(2, 17), new(14, 0), new(14, 17), new(2, 0)]
		]),
		new("Mask Mansion", new Space[,] {
			{ o, o, o, E, E, E, E, E, E, E, E, E, E, E, o, o, o },
			{ o, o, o, E, E, E, E, E, E, E, E, E, E, E, o, o, o },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, W, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, W, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, W, E, E, E, E, E, E, E, E },
			{ E, E, E, E, W, E, E, E, E, E, E, E, W, E, E, E, E },
			{ E, E, E, E, W, E, E, E, E, E, E, E, W, E, E, E, E },
			{ E, E, E, E, W, E, E, E, E, E, E, E, W, E, E, E, E },
			{ E, E, E, E, W, E, E, E, E, E, E, E, W, E, E, E, E },
			{ E, E, E, E, W, E, E, E, E, E, E, E, W, E, E, E, E },
			{ E, E, E, E, E, E, E, E, W, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, W, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, W, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ o, o, o, E, E, E, E, E, E, E, E, E, E, E, o, o, o },
			{ o, o, o, E, E, E, E, E, E, E, E, E, E, E, o, o, o },
		}, [
			[new(8, 15), new(8, 1), new(8, 8)],
			[new(3, 15), new(13, 1), new(13, 15), new(3, 1)]
		]),
		new("Sticky Thicket", new Space[,] {
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, W, E, E, E, W, E, E, E, W, E, E, E, W, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, B, E, E, E, W, E, E, E, W, E, E, E, W, E, E, E, A, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, W, E, E, E, W, E, E, E, W, E, E, E, W, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, B, E, E, E, W, E, E, E, W, E, E, E, W, E, E, E, A, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, W, E, E, E, W, E, E, E, W, E, E, E, W, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
		}, [
			[new(3, 20), new(3, 4)]
		]),
		new("Cracker Snap", new Space[,] {
			{ o, o, o, o, o, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ o, o, o, o, o, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, o, o, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, o, o, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, o, o, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, o, o, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, o, o, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, o, o, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, o, o, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, o, o, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, o, o, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, o, o, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, o, o, o, o, o },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, o, o, o, o, o },
		}, [
			[new(2, 17), new(11, 2), new(7, 11)],
			[new(9, 17), new(4, 2), new(11, 10), new(2, 9)]
		]),
		new("Two-Lane Splattop", new Space[,] {
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, B, E, E, E, E, E, E, E, E, E, E, E, E, A, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o, o },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, B, E, E, E, E, E, E, E, E, E, E, E, E, A, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
		}, [
			[new(11, 15), new(11, 2)]
		]),
		new("Pedal to the Metal", new Space[,] {
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, B, B, B, E, E, E, E, E, E, E, E, E, E, E, E, E, A, A, A, E, E, E },
			{ E, E, E, B, B, B, E, E, E, E, E, E, E, E, E, E, E, E, E, A, A, A, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E },
		}, [
			[new(4, 19), new(4, 3)]
		]),
		new("Over the Line", new Space[,] {
			{ E, E, E, E, E, E, E, E, E, E, b, a, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, b, A, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, b, A, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, b, a, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, b, a, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, b, a, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, b, a, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, b, a, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, B, a, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, B, a, E, E, E, E, E, E, E, E, E, E },
			{ E, E, E, E, E, E, E, E, E, E, b, a, E, E, E, E, E, E, E, E, E, E },
		}, [
			[new(1, 11), new(8, 10)]
		]),
	];

	public static Version Version { get; } = new(2, 0, 1, 0);
	public static DateTime LastModified { get; } = new(2024, 2, 24, 10, 0, 0, DateTimeKind.Utc);
	public static string JSON { get; }
	public static ReadOnlyCollection<Stage> Stages { get; }

	static StageDatabase() {
		Stages = Array.AsReadOnly(stages);
		JSON = JsonUtils.Serialise(stages);
	}
}
