using System.Diagnostics.CodeAnalysis;
using System.Net;
using System.Text;

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
	[JsonProperty("maxPlayers")]
	public int MaxPlayers { get; set; }
	[JsonProperty("stage")]
	public string? StageName { get; private set; }
	[JsonProperty("board")]
	public Space[,]? Board { get; private set; }
	[JsonProperty("startSpaces")]
	public Point[]? StartSpaces;

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

	public bool CanPlay(int playerIndex, Card card, int x, int y, int rotation, bool isSpecialAttack) {
		if (card is null) throw new ArgumentNullException(nameof(card));
		if (this.Board == null) return false;

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
		if (this.State == GameState.WaitingForPlayers && this.Players.Count >= 2 && this.Players.All(p => p.selectedStageIndex != null)) {
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
			this.Board = (Space[,]) stage.grid.Clone();

			// Place starting positions.
			var list = stage.startSpaces.Where(s => s.Length >= this.Players.Count).MinBy(s => s.Length) ?? throw new InvalidOperationException("Couldn't find start spaces");
			this.StartSpaces = list;
			for (int i = 0; i < this.Players.Count; i++)
				this.Board[list[i].X, list[i].Y] = Space.SpecialInactive1 | (Space) i;

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

			if (this.Board == null) throw new InvalidOperationException("No board?!");

			foreach (var player in this.Players) {
				var move = player.Move!;
				player.turns.Add(new() { CardNumber = move.Card.Number, X = move.X, Y = move.Y, Rotation = move.Rotation, IsPass = move.IsPass, IsSpecialAttack = move.IsSpecialAttack });
			}

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
					behaviour.SendInternal(JsonConvert.SerializeObject(new DTO.WebSocketPayloadWithPlayerData<T>(eventType, data, playerData)));
				} else {
					behaviour.SendInternal(JsonConvert.SerializeObject(new DTO.WebSocketPayload<T>(eventType, data)));
				}
			}
		}
	}

	public void WriteReplayData(Stream stream) {
		const int VERSION = 1;

		if (this.State < GameState.Ended)
			throw new InvalidOperationException("Can't save a replay until the game has ended.");

		using var writer = new BinaryWriter(stream, Encoding.UTF8, true);
		writer.Write((byte) VERSION);

		var stageNumber = Enumerable.Range(0, StageDatabase.Stages.Count).First(i => this.StageName == StageDatabase.Stages[i].Name);
		writer.Write((byte) (stageNumber | (this.Players.Count << 5)));
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
			foreach (var card in player.Deck!)
				writer.Write((byte) card.Number);
			for (int i = 0; i < 4; i += 2)
				writer.Write((byte) (player.initialDrawOrder![i] | player.initialDrawOrder[i + 1]));
			for (int i = 0; i < 15; i += 2)
				writer.Write((byte) (player.drawOrder![i] | (i < 14 ? player.drawOrder[i + 1] << 4 : player.UIBaseColourIsSpecialColour ? 0x80 : 0)));
			writer.Write(player.Name);
		}
		for (int i = 0; i < 12; i++) {
			foreach (var player in this.Players) {
				var move = player.turns[i];
				writer.Write((byte) move.CardNumber);
				writer.Write((byte) (move.Rotation | (move.IsPass ? 0x80 : 0) | (move.IsSpecialAttack ? 0x40 : 0)));
				writer.Write((sbyte) move.X);
				writer.Write((sbyte) move.Y);
			}
		}
	}
}
