using System.Diagnostics.CodeAnalysis;
using System.Timers;
using Timer = System.Timers.Timer;

namespace TableturfBattleServer;
internal class Server {
	public static Server Instance { get; } = new();

	internal Dictionary<Guid, Game> games = [];
	internal Dictionary<Guid, Game> inactiveGames = [];
	public bool Lockdown { get; set; }
	internal readonly Timer timer = new(1000);

	private const int InactiveGameLimit = 1000;
	private static readonly TimeSpan InactiveGameTimeout = TimeSpan.FromMinutes(5);

	private Server() => this.timer.Elapsed += this.Timer_Elapsed;

	internal bool TryGetGame(Guid gameID, [MaybeNullWhen(false)] out Game game) {
		if (games.TryGetValue(gameID, out game)) {
			game.abandonedSince = DateTime.UtcNow;
			return true;
		} else if (inactiveGames.TryGetValue(gameID, out game)) {
			inactiveGames.Remove(gameID);
			games[gameID] = game;
			game.abandonedSince = DateTime.UtcNow;
			Console.WriteLine($"{games.Count} games active; {inactiveGames.Count} inactive");
			return true;
		}
		return false;
	}

	private void Timer_Elapsed(object? sender, ElapsedEventArgs e) {
		lock (games) {
			foreach (var (id, game) in games) {
				lock (game.Players) {
					game.Tick();
					if (DateTime.UtcNow - game.abandonedSince >= InactiveGameTimeout) {
						games.Remove(id);
						inactiveGames.Add(id, game);
						Console.WriteLine($"{games.Count} games active; {inactiveGames.Count} inactive");
						if (Lockdown && games.Count == 0)
							Environment.Exit(2);
					}
				}
			}
			if (inactiveGames.Count >= InactiveGameLimit) {
				foreach (var (k, _) in inactiveGames.Select(e => (e.Key, e.Value.abandonedSince)).OrderBy(e => e.abandonedSince).Take(InactiveGameLimit / 2))
					inactiveGames.Remove(k);
				Console.WriteLine($"{games.Count} games active; {inactiveGames.Count} inactive");
			}
		}
	}

}