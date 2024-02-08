using Newtonsoft.Json;

namespace TableturfBattleServer;
public class Player(Game game, string name, Guid token) {
	public string Name { get; } = name ?? throw new ArgumentNullException(nameof(name));
	[JsonIgnore]
	public Guid Token { get; } = token;
	public Colour Colour { get; set; }
	public Colour SpecialColour { get; set; }
	public Colour SpecialAccentColour { get; set; }
	public bool UIBaseColourIsSpecialColour { get; set; }

	[JsonIgnore]
	internal List<TableturfWebSocketBehaviour> Connections { get; } = [];
	[JsonIgnore]
	public DateTime? DisconnectedAt { get; set; }
	public bool IsOnline => this.DisconnectedAt == null;

	public StageSelectionPrompt? StageSelectionPrompt { get; set; }

	[JsonIgnore]
	private readonly Game game = game ?? throw new ArgumentNullException(nameof(game));
	[JsonIgnore]
	internal readonly List<int> CardsUsed = new(12);
	[JsonIgnore]
	internal Card[]? Hand;
	[JsonIgnore]
	internal Move? Move;
	[JsonIgnore]
	internal Move? ProvisionalMove;
	[JsonIgnore]
	internal readonly Dictionary<int, int> customCardMap = new();

	public int GamesWon { get; set; }

	[JsonIgnore]
	internal List<SingleGameData> Games { get; } = [new()];

	[JsonIgnore]
	public SingleGameData CurrentGameData => this.Games[^1];
	[JsonIgnore]
	public bool WonLastGame => this.Games.Count > 1 && this.Games[^2].won;

	public int SpecialPoints => this.CurrentGameData.SpecialPoints;

	public int TotalSpecialPoints => this.CurrentGameData.TotalSpecialPoints;
	public int Passes => this.CurrentGameData.Passes;
	public int? Sleeves => this.CurrentGameData.Deck?.Sleeves;

	public bool IsReady => this.game.State switch {
		GameState.WaitingForPlayers or GameState.ChoosingStage => this.selectedStages != null,
		GameState.ChoosingDeck => this.CurrentGameData.Deck != null,
		_ => this.Move != null
	};

	[JsonIgnore]
	internal ICollection<int>? selectedStages;

	internal static readonly int[] RandomStageSelection = [-1];

	public void ClearMoves() {
		this.Move = null;
		this.ProvisionalMove = null;
	}

	internal void Shuffle(Random random) {
		this.CurrentGameData.drawOrder = new int[15];
		this.CurrentGameData.initialDrawOrder ??= this.CurrentGameData.drawOrder;
		for (int i = 0; i < 15; i++) this.CurrentGameData.drawOrder[i] = i;
		for (int i = 14; i > 0; i--) {
			var j = random.Next(i);
			(this.CurrentGameData.drawOrder[i], this.CurrentGameData.drawOrder[j]) = (this.CurrentGameData.drawOrder[j], this.CurrentGameData.drawOrder[i]);
		}
		if (this.CurrentGameData.Deck != null) {
			this.Hand = new Card[4];
			for (int i = 0; i < 4; i++) {
				this.Hand[i] = this.CurrentGameData.Deck.Cards[this.CurrentGameData.drawOrder[i]];
			}
		}
	}

	internal int GetHandIndex(int cardNumber) {
		if (this.Hand != null) {
			for (int i = 0; i < 4; i++) {
				if (this.Hand[i].Number == cardNumber) return i;
			}
		}
		return -1;
	}

	internal void AddConnection(TableturfWebSocketBehaviour connection) {
		lock (this.Connections) {
			this.Connections.Add(connection);
		}
	}

	internal void RemoveConnection(TableturfWebSocketBehaviour connection) {
		lock (this.Connections) {
			this.Connections.Remove(connection);
		}
	}
}
