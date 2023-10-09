﻿using Newtonsoft.Json;

namespace TableturfBattleServer;
public class Player {
	public string Name { get; }
	[JsonIgnore]
	public Guid Token { get; }
	public Colour Colour { get; set; }
	public Colour SpecialColour { get; set; }
	public Colour SpecialAccentColour { get; set; }
	public bool UIBaseColourIsSpecialColour { get; set; }

	[JsonIgnore]
	private readonly Game game;
	[JsonIgnore]
	internal readonly List<int> CardsUsed = new(12);
	[JsonIgnore]
	internal Card[]? Hand;
	[JsonIgnore]
	internal Move? Move;
	[JsonIgnore]
	internal Move? ProvisionalMove;

	public int GamesWon { get; set; }

	[JsonIgnore]
	internal List<SingleGameData> Games { get; } = new() { new() };

	[JsonIgnore]
	public SingleGameData CurrentGameData => this.Games[^1];

	public int SpecialPoints => this.CurrentGameData.SpecialPoints;

	public int TotalSpecialPoints => this.CurrentGameData.TotalSpecialPoints;
	public int Passes => this.CurrentGameData.Passes;
	public int? Sleeves => this.CurrentGameData.Deck?.Sleeves;

	public bool IsReady => this.game.State switch {
		GameState.WaitingForPlayers or GameState.ChoosingStage => this.selectedStageIndex != null,
		GameState.ChoosingDeck => this.CurrentGameData.Deck != null,
		_ => this.Move != null
	};

	[JsonIgnore]
	internal int? selectedStageIndex;

	public Player(Game game, string name, Guid token) {
		this.game = game ?? throw new ArgumentNullException(nameof(game));
		this.Name = name ?? throw new ArgumentNullException(nameof(name));
		this.Token = token;
	}

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
}
