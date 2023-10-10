using System.Diagnostics.CodeAnalysis;
using System.Net;
using System.Text;

using Newtonsoft.Json;

namespace TableturfBattleServer;
public class Game {
	[JsonIgnore]
	public Guid ID { get; } = Guid.NewGuid();

	public GameState State { get; set; }
	public int TurnNumber { get; set; }
	public List<Player> Players { get; } = new(4);
	public int MaxPlayers { get; set; }
	[JsonProperty("stage")]
	public string? StageName { get; private set; }
	public Space[,]? Board { get; private set; }
	public Point[]? StartSpaces;

	public int? GoalWinCount { get; set; }

	public int? TurnTimeLimit { get; set; }
	public int? TurnTimeLeft { get; set; }
	[JsonIgnore]
	internal DateTime abandonedSince = DateTime.UtcNow;

	[JsonIgnore]
	internal List<Deck> deckCache = new();
	[JsonIgnore]
	internal List<string> setStages = new();

	public Game(int maxPlayers) => this.MaxPlayers = maxPlayers;

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

	public Deck GetDeck(string name, int sleeves, IEnumerable<int> cardNumbers, IEnumerable<int> cardUpgrades) {
		var deck = this.deckCache.FirstOrDefault(d => d.Name == name && d.Sleeves == sleeves && cardNumbers.SequenceEqual(from c in d.Cards select c.Number) && cardUpgrades.SequenceEqual(d.Upgrades));
		if (deck == null) {
			deck = new(name, sleeves, (from i in cardNumbers select CardDatabase.GetCard(i)).ToArray(), cardUpgrades.ToArray());
			this.deckCache.Add(deck);
		}
		return deck;
	}

	public bool CanPlay(int playerIndex, Card card, int x, int y, int rotation, bool isSpecialAttack) {
		if (card is null) throw new ArgumentNullException(nameof(card));
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
					case Space.Wall: case Space.OutOfBounds:
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

	internal void Tick() {
		if (this.State is GameState.WaitingForPlayers or GameState.ChoosingStage && this.Players.Count >= 2 && this.Players.All(p => p.selectedStageIndex != null)) {
			// Choose colours.
			for (int i = 0; i < this.Players.Count; i++) {
				this.Players[i].Colour = i switch {
					0 => new(236, 249,   1),
					1 => new( 74,  92, 252),
					2 => new(249,   6, 224),
					_ => new(  6, 249, 148),
				};
				this.Players[i].SpecialColour = i switch {
					0 => new(250, 158,   0),
					1 => new(  1, 237, 254),
					2 => new(128,   6, 249),
					_ => new(  6, 249,   6),
				};
				this.Players[i].SpecialAccentColour = i switch {
					0 => new(249, 249,  31),
					1 => new(213, 225, 225),
					2 => new(235, 180, 253),
					_ => new(180, 253, 199),
				};
				this.Players[i].UIBaseColourIsSpecialColour = i != 1;
			}

			// Choose the stage.
			var random = new Random();
			var stageIndex = this.Players[random.Next(this.Players.Count)].selectedStageIndex!.Value;
			if (stageIndex < 0) stageIndex = random.Next(StageDatabase.Stages.Count);
			var stage = StageDatabase.Stages[stageIndex];
			this.StageName = stage.Name;
			this.setStages.Add(stage.Name);
			this.Board = (Space[,]) stage.grid.Clone();

			// Place starting positions.
			var list = stage.startSpaces.Where(s => s.Length >= this.Players.Count).MinBy(s => s.Length) ?? throw new InvalidOperationException("Couldn't find start spaces");
			this.StartSpaces = list;
			for (int i = 0; i < this.Players.Count; i++)
				this.Board[list[i].X, list[i].Y] = Space.SpecialInactive1 | (Space) i;

			this.State = GameState.ChoosingDeck;
			this.SendEvent("stateChange", this, true);
		} else if (this.State == GameState.ChoosingDeck && this.Players.All(p => p.CurrentGameData.Deck != null)) {
			// Draw cards.
			var random = new Random();
			foreach (var player in this.Players)
				player.Shuffle(random);

			this.State = GameState.Redraw;
			this.TurnTimeLeft = this.TurnTimeLimit;
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
			if (this.TurnTimeLeft <= -3) {  // Add a small grace period to account for network lag.
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
			foreach (var player in this.Players) {
				player.selectedStageIndex = null;
				player.Hand = null;
				player.CardsUsed.Clear();
				player.Games.Add(new());
				player.ClearMoves();
			}
			this.State = GameState.ChoosingStage;
			this.TurnTimeLeft = this.TurnTimeLimit;
			this.SendEvent("stateChange", this, true);
		}
	}

	internal void SendPlayerReadyEvent(int playerIndex, bool isTimeout) => this.SendEvent("playerReady", new { playerIndex, isTimeout }, false);

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
					behaviour.SendInternal(JsonUtils.Serialise(new DTO.WebSocketPayloadWithPlayerData<T>(eventType, data, playerData)));
				} else {
					behaviour.SendInternal(JsonUtils.Serialise(new DTO.WebSocketPayload<T>(eventType, data)));
				}
			}
		}
	}

	public void WriteReplayData(Stream stream) {
		const int VERSION = 3;

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

		// Deck cache
		writer.Write7BitEncodedInt(this.deckCache.Count);
		foreach (var deck in this.deckCache) {
			writer.Write(deck.Name);
			writer.Write((byte) deck.Sleeves);
			foreach (var card in deck.Cards)
				writer.Write((byte) card.Number);

			int upgradesPacked = 0;
			for (var i = 0; i < 15; i++)
				upgradesPacked |= deck.Upgrades[i] << (i * 2);
			writer.Write(upgradesPacked);
		}

		// Games
		for (int i = 0; i < this.Players[0].Games.Count; i++) {
			var stageNumber = Enumerable.Range(0, StageDatabase.Stages.Count).First(j => this.setStages[i] == StageDatabase.Stages[j].Name);
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
					writer.Write((byte) move.CardNumber);
					writer.Write((byte) ((move.Rotation & 3) | (move.IsPass ? 0x80 : 0) | (move.IsSpecialAttack ? 0x40 : 0) | (move.IsTimeout ? 0x20 : 0)));
					writer.Write((sbyte) move.X);
					writer.Write((sbyte) move.Y);
				}
			}
		}
	}
}
