using System.Diagnostics.CodeAnalysis;
using System.Drawing;

using Newtonsoft.Json;

namespace TableturfBattleServer;
public class Game {
	[JsonIgnore]
	public Guid ID { get; } = Guid.NewGuid();

	[JsonProperty("state")]
	public GameState State { get; set; }
	[JsonProperty("turnNumber")]
	public int TurnNumber { get; set; }
	[JsonProperty("players")]
	public List<Player> Players { get; } = new(4);
	[JsonProperty("board")]
	public Space[,] Board { get; }

	public Game(int boardWidth, int boardHeight) => this.Board = new Space[boardWidth, boardHeight];

	public bool TryAddPlayer(Player player, out int playerIndex, out Error error) {
		lock (this.Players) {
			if (this.State != GameState.WaitingForPlayers) {
				playerIndex = -1;
				error = new("GameAlreadyStarted", "The game has already started.");
				return false;
			}
			if (this.Players.Any(p => p.Token == player.Token)) {
				playerIndex = -1;
				error = new("PlayerAlreadyJoined", "You're already in the game.");
				return false;
			}
			if (this.Players.Count >= 4) {
				playerIndex = -1;
				error = new("GameFull", "The game is full.");
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

	public bool CanPlay(int playerIndex, Card card, int x, int y, int rotation, bool isSpecialAttack) {
		if (card is null) throw new ArgumentNullException(nameof(card));

		if (isSpecialAttack && (this.Players[playerIndex].SpecialPoints < card.SpecialCost))
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
		if (this.State == GameState.WaitingForPlayers && this.Players.Count >= 2) {
			this.Players[0].Colour = new Colour(236, 249, 1);
			this.Players[0].SpecialColour = new Colour(250, 158, 0);
			this.Players[0].SpecialAccentColour = new Colour(249, 249, 31);
			this.Players[1].Colour = new Colour(74, 92, 252);
			this.Players[1].SpecialColour = new Colour(1, 237, 254);
			this.Players[1].SpecialAccentColour = new Colour(213, 225, 225);
			this.State = GameState.Preparing;
			this.SendEvent("stateChange", this, true);
		} else if (this.State == GameState.Preparing && this.Players.All(p => p.Deck != null)) {
			// Draw cards.
			var random = new Random();
			foreach (var player in this.Players)
				player.Shuffle(random);

			this.State = GameState.Redraw;
			this.SendEvent("stateChange", this, true);
		} else if (this.State == GameState.Redraw && this.Players.All(p => p.Move != null)) {
			var random = new Random();
			foreach (var player in this.Players) {
				if (player.Move!.IsSpecialAttack) {
					player.Shuffle(random);
				}
				player.Move = null;
			}

			this.State = GameState.Ongoing;
			this.TurnNumber = 1;
			this.SendEvent("stateChange", this, true);
		} else if (this.State == GameState.Ongoing && this.Players.All(p => p.Move != null)) {
			var moves = new Move?[this.Players.Count];
			var placements = new List<Placement>();
			var specialSpacesActivated = new List<Point>();

			// Place the ink.
			(Placement placement, int cardSize)? placementData = null;
			foreach (var i in Enumerable.Range(0, this.Players.Count).Where(i => this.Players[i] != null).OrderByDescending(i => this.Players[i]!.Move!.Card.Size)) {
				var player = this.Players[i];
				var move = player.Move!;
				moves[i] = move;
				player.CardsUsed.Add(move.Card.Number);

				if (move.IsPass) {
					player.Passes++;
					player.SpecialPoints++;
					player.TotalSpecialPoints++;
				} else {
					if (move.IsSpecialAttack)
						player.SpecialPoints -= move.Card.SpecialCost;
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
										this.Board[x, y] = placement.SpacesAffected[point] = Space.SpecialInactive1 | (Space) i;
									}
									break;
							}
						}
					}
				}
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
							player.SpecialPoints++;
							player.TotalSpecialPoints++;
							specialSpacesActivated.Add(new(x, y));
						}
					}
				}
			}

			if (this.TurnNumber == 12) {
				this.State = GameState.Ended;
				this.SendEvent("gameEnd", new { game = this, moves, placements, specialSpacesActivated }, true);

				foreach (var player in this.Players) {
					player.Move = null;
				}
			} else {
				this.TurnNumber++;

				// Draw cards.
				foreach (var player in this.Players) {
					var index = player.GetHandIndex(player.Move!.Card.Number);
					var draw = player.drawOrder![this.TurnNumber + 2];
					player.Hand![index] = player.Deck![draw];
					player.Move = null;
				}
				this.SendEvent("turn", new { game = this, moves, placements, specialSpacesActivated }, true);
			}
		}
	}

	internal void SendPlayerReadyEvent(int playerIndex) => this.SendEvent("playerReady", new { playerIndex }, false);

	internal void SendEvent(string eventType, object? data, bool includePlayerData) {
		foreach (var session in Program.httpServer.WebSocketServices.Hosts.First().Sessions.Sessions) {
			if (session is TableturfWebSocketBehaviour behaviour && behaviour.GameID == this.ID) {
				if (includePlayerData) {
					object? playerData = null;
					for (int i = 0; i < this.Players.Count; i++) {
						var player = this.Players[i];
						if (player.Token == behaviour.ClientToken) {
							playerData = new { playerIndex = i, hand = player.Hand, deck = player.Deck, move = player.Move, cardsUsed = player.CardsUsed };
							break;
						}
					}
					behaviour.SendInternal(JsonConvert.SerializeObject(new { @event = eventType, data, playerData }));
				} else {
					behaviour.SendInternal(JsonConvert.SerializeObject(new { @event = eventType, data }));
				}
			}
		}
	}
}
