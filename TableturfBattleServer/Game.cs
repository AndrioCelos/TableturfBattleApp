using System.Diagnostics.CodeAnalysis;
using System.Net;
using System.Text;
using Newtonsoft.Json;

namespace TableturfBattleServer;
public class Game(int maxPlayers) {
	[JsonIgnore]
	public Guid ID { get; } = Guid.NewGuid();

	public GameState State { get; set; }
	public int TurnNumber { get; set; }
	public List<Player> Players { get; } = new(4);
	[JsonIgnore]
	internal Guid HostClientToken { get; set; }
	public int MaxPlayers { get; set; } = maxPlayers;
	[JsonProperty("stage")]
	public int? StageIndex { get; private set; }
	public Space[,]? Board { get; private set; }
	public Point[]? StartSpaces;

	public int? GoalWinCount { get; set; }

	public int? TurnTimeLimit { get; set; }
	public int? TurnTimeLeft { get; set; }
	[JsonIgnore]
	internal DateTime abandonedSince = DateTime.UtcNow;

	public bool AllowUpcomingCards { get; set; } = true;
	public bool AllowCustomCards { get; set; }

	public required StageSelectionRules StageSelectionRuleFirst { get; set; }
	public required StageSelectionRules StageSelectionRuleAfterWin { get; set; }
	public required StageSelectionRules StageSelectionRuleAfterDraw { get; set; }
	public bool ForceSameDeckAfterDraw { get; set; }

	public List<int> StruckStages = [];

	[JsonIgnore]
	internal List<Deck> deckCache = [];
	[JsonIgnore]
	internal List<Card> customCards = [];
	[JsonIgnore]
	internal List<int> setStages = [];

	private static readonly PlayerColours[] Colours = [
		new(new(0xf2200d), new(0xff8c1a), new(0xffd5cc), false),  // Red
		new(new(0xf2740d), new(0xff4000), new(0xffcc99), true),  // Orange
		new(new(0xecf901), new(0xfa9e00), new(0xf9f91f), true),  // Yellow
		new(new(0xc0f915), new(0x6aff00), new(0xe6ff99), true),  // LimeGreen
		new(new(0x06e006), new(0x33ffcc), new(0xb3ffd9), false),  // Green
		new(new(0x00ffea), new(0x00a8e0), new(0x99ffff), true),  // Turquoise
		new(new(0x4a5cfc), new(0x01edfe), new(0xd5e1e1), false),  // Blue
		new(new(0xa106ef), new(0xff00ff), new(0xffb3ff), false),  // Purple
		new(new(0xf906e0), new(0x8006f9), new(0xebb4fd), true),  // Magenta
	];

	public bool TryAddPlayer(Player player, out int playerIndex, out Error error) {
		lock (this.Players) {
			if (this.State != GameState.WaitingForPlayers) {
				playerIndex = -1;
				error = new(HttpStatusCode.Gone, "GameAlreadyStarted", "The game has already started.");
				return false;
			}
			if (this.Players.Any(p => p.Token == player.Token)) {
				playerIndex = -1;
				error = new(HttpStatusCode.Conflict, "PlayerAlreadyJoined", "You're already in the game.");
				return false;
			}
			if (this.Players.Count >= this.MaxPlayers) {
				playerIndex = -1;
				error = new(HttpStatusCode.Conflict, "GameFull", "The game is full.");
				return false;
			}
			playerIndex = this.Players.Count;
			this.Players.Add(player);

			player.StageSelectionPrompt = this.StageSelectionRuleFirst.Method switch {
				StageSelectionMethod.Vote => new() { PromptType = StageSelectionPromptType.Vote, BannedStages = this.StageSelectionRuleFirst.BannedStages, StruckStages = Array.Empty<int>() },
				StageSelectionMethod.Strike => new() { PromptType = StageSelectionPromptType.VoteOrder, BannedStages = this.StageSelectionRuleFirst.BannedStages, StruckStages = Array.Empty<int>() },
				_ => new() { PromptType = StageSelectionPromptType.Wait, BannedStages = this.StageSelectionRuleFirst.BannedStages, StruckStages = Array.Empty<int>() }
			};

			error = default;
			return true;
		}
	}

	public bool GetPlayer(Guid clientToken, [MaybeNullWhen(false)] out int playerIndex, [MaybeNullWhen(false)] out Player player) {
		for (var i = 0; i < this.Players.Count; i++) {
			var player2 = this.Players[i];
			if (player2.Token == clientToken) {
				playerIndex = i;
				player = player2;
				return true;
			}
		}
		playerIndex = -1;
		player = null;
		return false;
	}

	public bool TryChooseStages(Player player, ICollection<int> stages, out Error error) {
		if (player.StageSelectionPrompt == null || player.StageSelectionPrompt.Value.PromptType == StageSelectionPromptType.Wait) {
			error = new(HttpStatusCode.Conflict, "CannotChooseStage", "You cannot choose stages now.");
			return false;
		}
		if (player.selectedStages != null) {
			error = new(HttpStatusCode.Conflict, "StageAlreadyChosen", "You've already chosen a stage.");
			return false;
		}
		if (player.StageSelectionPrompt.Value.PromptType == StageSelectionPromptType.VoteOrder) {
			if (stages.Count != 1) {
				error = new(HttpStatusCode.BadRequest, "InvalidStage", "Invalid stage selection.");
				return false;
			}
		} else {
			if (stages.Any(i => i >= StageDatabase.Stages.Count)) {
				error = new(HttpStatusCode.UnprocessableEntity, "InvalidStage", "Invalid stage selection.");
				return false;
			}
			var rule = this.GetCurrentStageSelectionRule();
			if (stages.Intersect(rule.BannedStages).Any()) {
				error = new(HttpStatusCode.UnprocessableEntity, "IllegalStage", "A selected stage is banned.");
				return false;
			}
			if (player.StageSelectionPrompt.Value.StruckStages != null && stages.Intersect(player.StageSelectionPrompt.Value.StruckStages).Any()) {  // Includes stages previously won on when counterpicking.
				error = new(HttpStatusCode.UnprocessableEntity, "IllegalStage", "A selected stage was struck.");
				return false;
			}
		}
		player.selectedStages = stages;
		error = default;
		return true;
	}

	public Deck GetDeck(string name, int sleeves, IEnumerable<int> cardNumbers, IEnumerable<int> cardUpgrades) {
		var deck = this.deckCache.FirstOrDefault(d => d.Name == name && d.Sleeves == sleeves && cardNumbers.SequenceEqual(from c in d.Cards select c.Number) && cardUpgrades.SequenceEqual(d.Upgrades));
		if (deck == null) {
			deck = new(name, sleeves, (from i in cardNumbers select i <= ApiEndpoints.RECEIVED_CUSTOM_CARD_START ? customCards[ApiEndpoints.RECEIVED_CUSTOM_CARD_START - i] : CardDatabase.GetCard(i)).ToArray(), cardUpgrades.ToArray());
			this.deckCache.Add(deck);
		}
		return deck;
	}

	public bool CanPlay(int playerIndex, Card card, int x, int y, int rotation, bool isSpecialAttack) {
		ArgumentNullException.ThrowIfNull(card);
		if (this.Board is null || this.Players[playerIndex].CurrentGameData is not SingleGameData gameData) return false;

		if (isSpecialAttack && (gameData.SpecialPoints < card.SpecialCost))
			return false;

		var isAnchored = false;
		for (int dx = 0; dx < 8; dx++) {
			for (int dy = 0; dy < 8; dy++) {
				if (card.GetSpace(dx, dy, rotation) == Space.Empty)
					continue;
				var x2 = x + dx;
				var y2 = y + dy;
				if (x2 < 0 || x2 > this.Board.GetUpperBound(0)
					|| y2 < 0 || y2 > this.Board.GetUpperBound(1))
					return false;  // Out of bounds.
				switch (this.Board[x2, y2]) {
					case Space.Wall:
					case Space.OutOfBounds:
						return false;
					case >= Space.SpecialInactive1:
						return false;  // Can't overlap special spaces ever.
					case Space.Empty:
						break;
					default:
						if (!isSpecialAttack) return false;  // Can't overlap ink except with a special attack.
						break;
				}
				if (!isAnchored) {
					// A normal play must be adjacent to ink of the player's colour.
					// A special attack must be adjacent to a special space of theirs.
					for (int dy2 = -1; dy2 <= 1; dy2++) {
						for (int dx2 = -1; dx2 <= 1; dx2++) {
							if (dx2 == 0 && dy2 == 0) continue;
							var x3 = x2 + dx2;
							var y3 = y2 + dy2;
							if (x3 < 0 || x3 > this.Board.GetUpperBound(0)
								|| y3 < 0 || y3 > this.Board.GetUpperBound(1))
								continue;
							if (this.Board[x3, y3] >= (isSpecialAttack ? Space.SpecialInactive1 : Space.Ink1)
								&& (((int) this.Board[x3, y3]) & 3) == playerIndex) {
								isAnchored = true;
								break;
							}
						}
					}
				}
			}
		}
		return isAnchored;
	}

	private StageSelectionRules GetCurrentStageSelectionRule() {
		return this.Players.Count == 0 || this.Players[0].Games.Count <= 1
			? this.StageSelectionRuleFirst
			: this.Players.Any(p => p.Games[^2].won) ? this.StageSelectionRuleAfterWin : this.StageSelectionRuleAfterDraw;
	}

	internal void Tick() {
		if (this.State is GameState.WaitingForPlayers or GameState.ChoosingStage && this.Players.Count >= 2 && this.Players.All(p => p.StageSelectionPrompt == null || p.StageSelectionPrompt.Value.PromptType == StageSelectionPromptType.Wait || p.selectedStages != null)) {
			// Choose colours.
			var random = new Random();
			if (this.State == GameState.WaitingForPlayers) {
				this.State = GameState.ChoosingStage;
				var index = random.Next(Colours.Length);
				var increment = this.Players.Count switch {
					2 => random.Next(3, 7),
					3 => random.Next(2, 4),
					_ => 2
				};
				for (int i = 0; i < this.Players.Count; i++) {
					var colours = Colours[index];
					index = (index + increment) % Colours.Length;
					this.Players[i].Colour = colours.InkColour;
					this.Players[i].SpecialColour = colours.SpecialColour;
					this.Players[i].SpecialAccentColour = colours.SpecialAccentColour;
					this.Players[i].UIBaseColourIsSpecialColour = colours.UIBaseColourIsSpecialColour;
				}
			}

			// Choose the stage.
			var rule = this.GetCurrentStageSelectionRule();
			switch (rule.Method) {
				case StageSelectionMethod.Vote: {
					var stageIndex = this.Players[random.Next(this.Players.Count)].selectedStages!.First();
					if (stageIndex < 0) stageIndex = random.Next(StageDatabase.Stages.Count);
					this.LockInStage(stageIndex);
					this.SendEvent("stateChange", this, true);
					break;
				}
				case StageSelectionMethod.Random: {
					var legalStages = Enumerable.Range(0, StageDatabase.Stages.Count).Except(rule.BannedStages).ToList();
					var stageIndex = legalStages[random.Next(legalStages.Count)];
					this.LockInStage(stageIndex);
					this.SendEvent("stateChange", this, true);
					break;
				}
				case StageSelectionMethod.Counterpick: {
					var player = this.Players.FirstOrDefault(p => p.StageSelectionPrompt != null && p.StageSelectionPrompt?.PromptType != StageSelectionPromptType.Wait);
					if (player == null) {
						var legalStages = Enumerable.Range(0, StageDatabase.Stages.Count).Except(rule.BannedStages).ToList();
						this.LockInStage(legalStages[random.Next(legalStages.Count)]);
					} else {
						if (player.selectedStages!.First() >= 0)
							this.LockInStage(player.selectedStages!.First());
						else {
							var legalStages = Enumerable.Range(0, StageDatabase.Stages.Count).Except(rule.BannedStages).Except(player.StageSelectionPrompt!.Value.StruckStages).ToList();
							this.LockInStage(legalStages[random.Next(legalStages.Count)]);
						}
					}
					this.SendEvent("stateChange", this, true);
					break;
				}
				case StageSelectionMethod.Strike: {
					var player = this.Players.FirstOrDefault(p => p.StageSelectionPrompt != null && p.StageSelectionPrompt?.PromptType != StageSelectionPromptType.Wait) ?? throw new InvalidOperationException("Couldn't find striking player?!");
					switch (player.StageSelectionPrompt!.Value.PromptType) {
						case StageSelectionPromptType.VoteOrder:
							// Choose who will strike first.
							Player? firstPlayer = null;
							foreach (var player2 in this.Players) {
								if (player2.selectedStages!.First() == 0) {
									if (firstPlayer == null || random.Next(2) == 0)
										firstPlayer = player2;
								}
							}
							firstPlayer ??= this.Players[random.Next(this.Players.Count)];
							// Present new prompts.
							foreach (var player2 in this.Players) {
								player2.StageSelectionPrompt = new() { PromptType = player2 == firstPlayer ? StageSelectionPromptType.Strike : StageSelectionPromptType.Wait, BannedStages = rule.BannedStages, NumberOfStagesToStrike = 1 };
								player2.selectedStages = null;
							}
							break;
						case StageSelectionPromptType.Strike:
							this.StruckStages.AddRange(player.selectedStages!);
							var index = this.Players.IndexOf(player);
							index = (index + 1) % this.Players.Count;

							// Present new prompts.
							for (var i = 0; i < this.Players.Count; i++) {
								this.Players[i].StageSelectionPrompt = i == index
									? this.StruckStages.Count == 2 || Enumerable.Range(0, StageDatabase.Stages.Count).Except(rule.BannedStages).Except(this.StruckStages).Count() <= 3
										? new() { PromptType = StageSelectionPromptType.Choose, BannedStages = rule.BannedStages, StruckStages = this.StruckStages }
										: new() { PromptType = StageSelectionPromptType.Strike, BannedStages = rule.BannedStages, StruckStages = this.StruckStages, NumberOfStagesToStrike = 2 }
									: new() { PromptType = StageSelectionPromptType.Wait, BannedStages = rule.BannedStages, StruckStages = this.StruckStages };
							}
							break;
						case StageSelectionPromptType.Choose:
							if (player.selectedStages!.First() >= 0)
								this.LockInStage(player.selectedStages!.First());
							else {
								var legalStages = Enumerable.Range(0, StageDatabase.Stages.Count).Except(rule.BannedStages).Except(player.StageSelectionPrompt!.Value.StruckStages).ToList();
								this.LockInStage(legalStages[random.Next(legalStages.Count)]);
							}
							break;
					}
					this.SendEvent("stateChange", this, true);
					foreach (var player2 in this.Players)
						player2.selectedStages = null;
					break;
				}
			}
		} else if (this.State == GameState.ChoosingDeck && this.Players.All(p => p.CurrentGameData.Deck != null)) {
			this.StartGame();
			this.SendEvent("stateChange", this, true);
		} else if (this.State == GameState.Redraw && this.Players.All(p => p.Move != null)) {
			var random = new Random();
			foreach (var player in this.Players) {
				if (player.Move!.IsSpecialAttack) {
					player.Shuffle(random);
				}
				player.ClearMoves();
			}

			this.State = GameState.Ongoing;
			this.TurnNumber = 1;
			this.TurnTimeLeft = this.TurnTimeLimit;
			this.SendEvent("stateChange", this, true);
		} else if (this.State == GameState.Ongoing && this.Players.All(p => p.Move != null)) {
			var moves = new Move?[this.Players.Count];
			var placements = new List<Placement>();
			var anySpecialAttacks = false;
			var specialSpacesActivated = new List<Point>();

			if (this.Board == null) throw new InvalidOperationException("No board?!");

			foreach (var player in this.Players) {
				var move = player.Move!;
				player.CurrentGameData.turns.Add(new() { CardNumber = move.Card.Number, X = move.X, Y = move.Y, Rotation = move.Rotation, IsPass = move.IsPass, IsTimeout = move.IsTimeout, IsSpecialAttack = move.IsSpecialAttack });
			}

			// Place the ink.
			(Placement placement, int cardSize)? placementData = null;
			var coveringMoves = 0;
			foreach (var i in Enumerable.Range(0, this.Players.Count).Where(i => this.Players[i] != null).OrderByDescending(i => this.Players[i]!.Move!.Card.Size)) {
				var player = this.Players[i];
				var move = player.Move!;
				var isCovering = false;
				moves[i] = move;
				player.CardsUsed.Add(move.Card.Number);

				if (move.IsPass) {
					player.CurrentGameData.Passes++;
					player.CurrentGameData.SpecialPoints++;
				} else {
					if (move.IsSpecialAttack) {
						anySpecialAttacks = true;
						player.CurrentGameData.SpecialPoints -= move.Card.SpecialCost;
					}
					if (placementData == null || move.Card.Size != placementData.Value.cardSize) {
						if (placementData != null)
							placements.Add(placementData.Value.placement);
						placementData = (new(), move.Card.Size);
					}
					var placement = placementData.Value.placement;
					placement.Players.Add(i);
					for (int dy = 0; dy < 8; dy++) {
						var y = move.Y + dy;
						for (int dx = 0; dx < 8; dx++) {
							var x = move.X + dx;
							var point = new Point(x, y);
							switch (move.Card.GetSpace(dx, dy, move.Rotation)) {
								case Space.Ink1:
									if (placement.SpacesAffected.TryGetValue(point, out var space)) {
										if (space < Space.SpecialInactive1) {
											// Two ink spaces overlapped; create a wall there.
											this.Board[x, y] = placement.SpacesAffected[point] = Space.Wall;
										}
									} else {
										isCovering = this.Board[x, y] != Space.Empty;
										if (this.Board[x, y] < Space.SpecialInactive1)  // Ink spaces can't overlap special spaces from larger cards.
											this.Board[x, y] = placement.SpacesAffected[point] = Space.Ink1 | (Space) i;
									}
									break;
								case Space.SpecialInactive1:
									if (placement.SpacesAffected.TryGetValue(point, out space) && space >= Space.SpecialInactive1) {
										// Two special spaces overlapped; create a wall there.
										this.Board[x, y] = placement.SpacesAffected[point] = Space.Wall;
									} else {
										// If a special space overlaps an ink space, overwrite it.
										isCovering = this.Board[x, y] != Space.Empty;
										this.Board[x, y] = placement.SpacesAffected[point] = Space.SpecialInactive1 | (Space) i;
									}
									break;
							}
						}
					}
				}
				if (isCovering) coveringMoves++;
			}
			if (placementData != null)
				placements.Add(placementData.Value.placement);

			// Activate special spaces.
			for (int y = 0; y < this.Board.GetLength(1); y++) {
				for (int x = 0; x < this.Board.GetLength(0); x++) {
					if ((this.Board[x, y] & Space.SpecialActive1) == Space.SpecialInactive1) {
						var anyEmptySpace = false;
						for (int dy = -1; !anyEmptySpace && dy <= 1; dy++) {
							for (int dx = -1; dx <= 1; dx++) {
								var x2 = x + dx;
								var y2 = y + dy;
								if (x2 >= 0 && x2 < this.Board.GetLength(0) && y2 >= 0 && y2 < this.Board.GetLength(1)
									&& this.Board[x2, y2] == Space.Empty) {
									anyEmptySpace = true;
									break;
								}
							}
						}
						if (!anyEmptySpace) {
							var player = this.Players[(int) this.Board[x, y] & 3]!;
							this.Board[x, y] |= Space.SpecialActive1;
							player.CurrentGameData.SpecialPoints++;
							player.CurrentGameData.TotalSpecialPoints++;
							specialSpacesActivated.Add(new(x, y));
						}
					}
				}
			}

			if (this.TurnNumber >= 12) {
				this.TurnTimeLeft = null;
				this.State = this.GoalWinCount is not null ? GameState.GameEnded : GameState.SetEnded;

				// Determine the winner and check whether a player has won the set yet.
				var scores = new int[this.Players.Count]; int? winner = null; int maxScore = 0;
				for (var x = 0; x < this.Board.GetLength(0); x++) {
					for (var y = 0; y < this.Board.GetLength(1); y++) {
						if (((int) this.Board[x, y] & 0xC) != 0)
							scores[(int) this.Board[x, y] & 0x3]++;
					}
				}
				for (var i = 0; i < scores.Length; i++) {
					if (scores[i] > maxScore) {
						winner = i;
						maxScore = scores[i];
					} else if (scores[i] == maxScore)
						winner = null;
				}
				if (winner is not null) {
					this.Players[winner.Value].CurrentGameData.won = true;
					this.Players[winner.Value].GamesWon++;
					if (this.Players[winner.Value].GamesWon >= this.GoalWinCount)
						this.State = GameState.SetEnded;
				}

				foreach (var player in this.Players) player.ClearMoves();
				this.SendEvent("gameEnd", new { game = this, moves, placements, specialSpacesActivated }, true);
			} else {
				this.TurnNumber++;
				this.TurnTimeLeft = this.TurnTimeLimit + (anySpecialAttacks ? 6 : 4) + coveringMoves + (specialSpacesActivated.Count > 0 ? 1 : 0);  // Extra seconds for the animations.

				// Draw cards.
				foreach (var player in this.Players) {
					var index = player.GetHandIndex(player.Move!.Card.Number);
					var draw = player.CurrentGameData.drawOrder![this.TurnNumber + 2];
					player.Hand![index] = player.CurrentGameData.Deck!.Cards[draw];
					player.ClearMoves();
				}
				this.SendEvent("turn", new { game = this, moves, placements, specialSpacesActivated }, true);
			}
		} else if (this.TurnTimeLeft != null) {
			--this.TurnTimeLeft;
			if (this.TurnTimeLeft <= -3 || (this.TurnTimeLeft <= 0 && this.Players.All(p => p.IsReady || !p.IsOnline))) {  // Add a small grace period to account for network lag for online players.
				for (var i = 0; i < this.Players.Count; i++) {
					var player = this.Players[i];
					if (player.Move == null) {
						if (this.State == GameState.Redraw) {
							// If someone times out during the redraw state, don't redraw.
							player.Move = new(player.Hand![0], false, 0, 0, 0, false, true);
							this.SendPlayerReadyEvent(i, true);
						} else if (this.State == GameState.Ongoing) {
							if (player.ProvisionalMove != null)
								player.Move = player.ProvisionalMove;
							else {
								// If someone times out during a game and didn't have a valid move highlighted, they'll automatically discard their largest card.
								player.Move = new(player.Hand!.MaxBy(c => c.Size)!, true, 0, 0, 0, false, true);
							}
							this.SendPlayerReadyEvent(i, true);
						}
					}
				}
			}
		} else if (this.State is GameState.GameEnded or GameState.SetEnded && this.Players.All(p => p.Move != null)) {
			this.SetupNextGame();
		}
	}

	private void LockInStage(int stageIndex) {
		var stage = StageDatabase.Stages[stageIndex];
		this.StageIndex = stageIndex;
		this.setStages.Add(stageIndex);
		this.Board = (Space[,]) stage.Grid.Clone();

		// Place starting positions.
		var list = stage.StartSpaces.Where(s => s.Length >= this.Players.Count).MinBy(s => s.Length) ?? throw new InvalidOperationException("Couldn't find start spaces");
		this.StartSpaces = list;
		for (int i = 0; i < this.Players.Count; i++)
			this.Board[list[i].X, list[i].Y] = Space.SpecialInactive1 | (Space) i;

		foreach (var player in this.Players) {
			player.StageSelectionPrompt = null;
			player.selectedStages = null;
		}

		if (this.ForceSameDeckAfterDraw && this.Players[0].Games.Count > 1 && !this.Players.Any(p => p.WonLastGame)) {
			foreach (var player in this.Players)
				player.CurrentGameData.Deck = player.Games[^2].Deck;
			this.StartGame();
		} else
			this.State = GameState.ChoosingDeck;
	}

	private void StartGame() {
		// Draw cards.
		var random = new Random();
		foreach (var player in this.Players)
			player.Shuffle(random);

		this.State = GameState.Redraw;
		this.TurnTimeLeft = this.TurnTimeLimit;
	}

	private void SetupNextGame() {
		this.State = GameState.ChoosingStage;
		this.StruckStages.Clear();
		this.TurnTimeLeft = this.TurnTimeLimit;

		var winner = this.Players.FirstOrDefault(p => p.CurrentGameData.won);

		foreach (var player in this.Players) {
			player.selectedStages = null;
			player.Hand = null;
			player.CardsUsed.Clear();
			player.ClearMoves();
			player.Games.Add(new());
		}

		var rule = this.GetCurrentStageSelectionRule();
		var legalStages = Enumerable.Range(0, StageDatabase.Stages.Count).Except(rule.BannedStages).ToList();
		switch (rule.Method) {
			case StageSelectionMethod.Same:
				this.LockInStage(this.setStages[^1]);
				break;
			case StageSelectionMethod.Vote: {
				if (legalStages.Count == 1) {
					this.LockInStage(legalStages[0]);
					break;
				}
				var bannedStages = legalStages.Count == 0 ? [] : rule.BannedStages;
				foreach (var player in this.Players) {
					player.StageSelectionPrompt = new() { PromptType = StageSelectionPromptType.Vote, BannedStages = bannedStages, StruckStages = [] };
				}
				break;
			}
			case StageSelectionMethod.Random: {
				var random = new Random();
				var stage = legalStages.Count switch {
					0 => random.Next(StageDatabase.Stages.Count),
					1 => legalStages[0],
					_ => legalStages[random.Next(legalStages.Count)]
				};
				this.LockInStage(stage);
				break;
			}
			case StageSelectionMethod.Counterpick: {
				var playerPicking = this.Players.FirstOrDefault(p => p != winner) ?? this.Players[0];  // Should never reach the latter case.

				// Prevent picking stages that the player has previously won on if that would leave any legal stages.
				var struckStages = new HashSet<int>();
				for (var i = 0; i < playerPicking.Games.Count; i++) {
					if (playerPicking.Games[i].won && !rule.BannedStages.Contains(this.setStages[i]))
						struckStages.Add(this.setStages[i]);
				}

				foreach (var player in this.Players)
					player.StageSelectionPrompt = new() { PromptType = player == playerPicking ? StageSelectionPromptType.Choose : StageSelectionPromptType.Wait, BannedStages = rule.BannedStages, StruckStages = struckStages };
				break;
			}
			case StageSelectionMethod.Strike: {
				if (winner == null) {
					foreach (var player in this.Players)
						player.StageSelectionPrompt = new() { PromptType = StageSelectionPromptType.VoteOrder, BannedStages = rule.BannedStages, StruckStages = Array.Empty<int>() };
				} else {
					// After a win, the winner strikes first.
					foreach (var player in this.Players)
						player.StageSelectionPrompt = new() { PromptType = player == winner ? StageSelectionPromptType.Strike : StageSelectionPromptType.Wait, BannedStages = rule.BannedStages, StruckStages = Array.Empty<int>(), NumberOfStagesToStrike = 2 };
				}
				break;
			}
		}

		this.SendEvent("stateChange", this, true);
	}

	internal void SendPlayerReadyEvent(int playerIndex, bool isTimeout) => this.SendEvent("playerReady", new { playerIndex, isTimeout }, false);

	internal void AddConnection(int playerIndex, TableturfWebSocketBehaviour connection) {
		var player = this.Players[playerIndex];
		player.AddConnection(connection);
		if (!player.IsOnline) {
			player.DisconnectedAt = null;
			this.SendEvent("playerOnline", new { playerIndex, player.IsOnline }, false);
		}
	}
	internal void RemoveConnection(Player player, TableturfWebSocketBehaviour connection) {
		var playerIndex = this.Players.IndexOf(player);
		player.RemoveConnection(connection);
		if (player.IsOnline && player.Connections.Count == 0) {
			if (this.State == GameState.WaitingForPlayers) {
				this.Players.RemoveAt(playerIndex);
				this.SendEvent("leave", new { playerIndex }, false);
			} else {
				player.DisconnectedAt = DateTime.UtcNow;
				this.SendEvent("playerOnline", new { playerIndex, player.IsOnline }, false);
			}
		}
	}

	internal void SendEvent<T>(string eventType, T data, bool includePlayerData) {
		foreach (var session in Program.httpServer!.WebSocketServices.Hosts.First().Sessions.Sessions) {
			if (session is TableturfWebSocketBehaviour behaviour && behaviour.GameID == this.ID) {
				if (includePlayerData) {
					DTO.PlayerData? playerData = null;
					for (int i = 0; i < this.Players.Count; i++) {
						var player = this.Players[i];
						if (player.Token == behaviour.ClientToken) {
							playerData = new(i, player);
							break;
						}
					}
					behaviour.SendInternal(JsonUtils.Serialise(new DTO.WebSocketPayloadWithPlayerData<T>(eventType, data, playerData, behaviour.ClientToken == this.HostClientToken)));
				} else {
					behaviour.SendInternal(JsonUtils.Serialise(new DTO.WebSocketPayload<T>(eventType, data)));
				}
			}
		}
	}

	public void WriteReplayData(Stream stream) {
		const int VERSION = 4;

		if (this.State < GameState.SetEnded)
			throw new InvalidOperationException("Can't save a replay until the set has ended.");

		using var writer = new BinaryWriter(stream, Encoding.UTF8, true);
		writer.Write((byte) VERSION);

		// Players
		writer.Write((byte) (this.Players.Count | (this.GoalWinCount ?? 0) << 4));
		foreach (var player in this.Players) {
			writer.Write((byte) player.Colour.R);
			writer.Write((byte) player.Colour.G);
			writer.Write((byte) player.Colour.B);
			writer.Write((byte) player.SpecialColour.R);
			writer.Write((byte) player.SpecialColour.G);
			writer.Write((byte) player.SpecialColour.B);
			writer.Write((byte) player.SpecialAccentColour.R);
			writer.Write((byte) player.SpecialAccentColour.G);
			writer.Write((byte) player.SpecialAccentColour.B);

			var nameBytes = Encoding.UTF8.GetBytes(player.Name);
			writer.Write((byte) (nameBytes.Length | (player.UIBaseColourIsSpecialColour ? 0x80 : 0)));
			writer.Write(nameBytes);
		}

		// Custom cards
		writer.Write7BitEncodedInt(this.customCards.Count);
		foreach (var card in this.customCards) {
			writer.Write(card.Line1 ?? card.Name);
			writer.Write(card.Line2 ?? "");
			writer.Write((byte) card.Rarity);
			writer.Write((byte) card.SpecialCost);
			writer.Write((byte) card.InkColour1.GetValueOrDefault().R);
			writer.Write((byte) card.InkColour1.GetValueOrDefault().G);
			writer.Write((byte) card.InkColour1.GetValueOrDefault().B);
			writer.Write((byte) card.InkColour2.GetValueOrDefault().R);
			writer.Write((byte) card.InkColour2.GetValueOrDefault().G);
			writer.Write((byte) card.InkColour2.GetValueOrDefault().B);
			for (var x = 0; x < 8; x++) {
				for (var y = 0; y < 8; y += 4)
					writer.Write((byte) ((int) card.GetSpace(x, y, 0) >> 2 | (int) card.GetSpace(x, y + 1, 0) | (int) card.GetSpace(x, y + 2, 0) << 2 | (int) card.GetSpace(x, y + 3, 0) << 4));
			}
		}

		// Deck cache
		writer.Write7BitEncodedInt(this.deckCache.Count);
		foreach (var deck in this.deckCache) {
			writer.Write(deck.Name);
			writer.Write((byte) deck.Sleeves);
			foreach (var card in deck.Cards)
				writer.Write((short) card.Number);

			int upgradesPacked = 0;
			for (var i = 0; i < 15; i++)
				upgradesPacked |= deck.Upgrades[i] << (i * 2);
			writer.Write(upgradesPacked);
		}

		// Games
		for (int i = 0; i < this.Players[0].Games.Count; i++) {
			var stageNumber = this.setStages[i];
			writer.Write((byte) stageNumber);

			foreach (var player in this.Players) {
				var gameData = player.Games[i];
				writer.Write7BitEncodedInt(this.deckCache.IndexOf(gameData.Deck!));
				for (int j = 0; j < 4; j += 2)
					writer.Write((byte) (gameData.initialDrawOrder![j] | gameData.initialDrawOrder[j + 1] << 4));
				for (int j = 0; j < 15; j += 2)
					writer.Write((byte) (gameData.drawOrder![j] | (j < 14 ? gameData.drawOrder[j + 1] << 4 : gameData.won ? 0x80 : 0)));
			}
			for (int j = 0; j < 12; j++) {
				foreach (var player in this.Players) {
					var move = player.Games[i].turns[j];
					writer.Write((short) move.CardNumber);
					writer.Write((byte) ((move.Rotation & 3) | (move.IsPass ? 0x80 : 0) | (move.IsSpecialAttack ? 0x40 : 0) | (move.IsTimeout ? 0x20 : 0)));
					writer.Write((sbyte) move.X);
					writer.Write((sbyte) move.Y);
				}
			}
		}
	}
}
