using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Timers;
using System.Web;

using Newtonsoft.Json;

using WebSocketSharp.Server;

using Timer = System.Timers.Timer;

namespace TableturfBattleServer;

internal class Program {
	internal static HttpServer httpServer = new(IPAddress.Loopback, 3333);
	internal static Dictionary<Guid, Game> games = new();
	internal static readonly Timer timer = new(500);
	private static readonly List<Guid> gameIdsToRemove = new();

	internal static void Main() {
		timer.Elapsed += Timer_Elapsed;

		httpServer.AddWebSocketService<TableturfWebSocketBehaviour>("/api/websocket");
		httpServer.OnGet += HttpServer_OnRequest;
		httpServer.OnPost += HttpServer_OnRequest;
		httpServer.Start();
		Console.WriteLine($"Listening on http://{httpServer.Address}:{httpServer.Port}");

		Thread.Sleep(Timeout.Infinite);
	}

	private static void Timer_Elapsed(object? sender, ElapsedEventArgs e) {
		lock (games) {
			foreach (var (id, game) in games) {
				lock (game.Players) {
					game.Tick();
				}
			}
		}
	}

	private static void HttpServer_OnRequest(object? sender, HttpRequestEventArgs e) {
		e.Response.AppendHeader("Access-Control-Allow-Origin", "*");
		if (e.Request.RawUrl == "/api/games/new") {
			if (e.Request.HttpMethod != "POST") {
				e.Response.StatusCode = (int) HttpStatusCode.MethodNotAllowed;
				e.Response.AddHeader("Allow", "POST");
			} else if (e.Request.ContentLength64 >= 65536) {
				e.Response.StatusCode = (int) HttpStatusCode.RequestEntityTooLarge;
			} else {
				try {
					var d = DecodeFormData(e.Request.InputStream);
					Guid clientToken;
					if (!d.TryGetValue("name", out var name)) {
						SetErrorResponse(e.Response, (int) HttpStatusCode.UnprocessableEntity, new("InvalidName", "Missing name."));
						return;
					}
					if (d.TryGetValue("clientToken", out var tokenString) && tokenString != "") {
						if (!Guid.TryParse(tokenString, out clientToken)) {
							SetErrorResponse(e.Response, (int) HttpStatusCode.UnprocessableEntity, new("InvalidClientToken", "Invalid client token."));
							return;
						}
					} else
						clientToken = Guid.NewGuid();
					var game = new Game(9, 26);
					game.Board[4, 4] = Space.SpecialInactive2;
					game.Board[4, 21] = Space.SpecialInactive1;
					game.Players.Add(new(name, clientToken));
					games.Add(game.ID, game);

					SetResponse(e.Response, (int) HttpStatusCode.OK, "application/json", JsonConvert.SerializeObject(new { gameID = game.ID, clientToken }));
				} catch (ArgumentException) {
					e.Response.StatusCode = (int) HttpStatusCode.BadRequest;
				}
			}
		} else if (e.Request.RawUrl == "/api/cards") {
			if (e.Request.HttpMethod is not ("GET" or "HEAD")) {
				e.Response.StatusCode = (int) HttpStatusCode.MethodNotAllowed;
				e.Response.AddHeader("Allow", "GET, HEAD");
				return;
			}
			e.Response.AppendHeader("Cache-Control", "max-age=86400");
			e.Response.AppendHeader("ETag", CardDatabase.Version.ToString());
			if (e.Response.Headers["If-None-Match"] == CardDatabase.Version.ToString()) {
				e.Response.StatusCode = (int) HttpStatusCode.NotModified;
			} else {
				SetResponse(e.Response, (int) HttpStatusCode.OK, "application/json", CardDatabase.JSON);
			}
		} else {
			var m = Regex.Match(e.Request.RawUrl, @"^/api/games/([\w-]+)(?:/(\w+)(?:/([\w-]+))?)?$", RegexOptions.Compiled);
			if (m.Success) {
				if (!Guid.TryParse(m.Groups[1].Value, out var gameID)) {
					SetResponse(e.Response, 400, "text/plain", "Invalid game ID");
					return;
				}
				lock (games) {
					if (!games.TryGetValue(gameID, out var game)) {
						SetResponse(e.Response, 404, "text/plain", "Game not found");
						return;
					}
					lock (game.Players) {
						switch (m.Groups[2].Value) {
							case "": {
								if (e.Request.HttpMethod is not ("GET" or "HEAD")) {
									e.Response.StatusCode = (int) HttpStatusCode.MethodNotAllowed;
									e.Response.AddHeader("Allow", "GET, HEAD");
									return;
								}
								SetResponse(e.Response, (int) HttpStatusCode.OK, "application/json", JsonConvert.SerializeObject(game));
								break;
							}
							case "playerData": {
								if (e.Request.HttpMethod is not ("GET" or "HEAD")) {
									e.Response.StatusCode = (int) HttpStatusCode.MethodNotAllowed;
									e.Response.AddHeader("Allow", "GET, HEAD");
									return;
								}

								if (!Guid.TryParse(m.Groups[3].Value, out var clientToken))
									clientToken = Guid.Empty;

								SetResponse(e.Response, (int) HttpStatusCode.OK, "application/json", JsonConvert.SerializeObject(new {
									game,
									playerData = game.GetPlayer(clientToken, out var playerIndex, out var player)
										? new { playerIndex, hand = player.Hand, deck = player.Deck, cardsUsed = player.CardsUsed, move = player.Move }
										: null
								}));
								break;
							}

							case "join": {
								if (e.Request.HttpMethod != "POST") {
									e.Response.StatusCode = (int) HttpStatusCode.MethodNotAllowed;
									e.Response.AddHeader("Allow", "POST");
								} else if (e.Request.ContentLength64 >= 65536) {
									e.Response.StatusCode = (int) HttpStatusCode.RequestEntityTooLarge;
								} else {
									try {
										var d = DecodeFormData(e.Request.InputStream);
										Guid clientToken;
										if (!d.TryGetValue("name", out var name)) {
											SetErrorResponse(e.Response, (int) HttpStatusCode.UnprocessableEntity, new("InvalidName", "Missing name."));
											return;
										}
										if (d.TryGetValue("clientToken", out var tokenString) && tokenString != "") {
											if (!Guid.TryParse(tokenString, out clientToken)) {
												SetErrorResponse(e.Response, (int) HttpStatusCode.BadRequest, new("InvalidClientToken", "Invalid client token."));
												return;
											}
										} else
											clientToken = Guid.NewGuid();

										if (!game.GetPlayer(clientToken, out var playerIndex, out var player)) {
											if (game.State != GameState.WaitingForPlayers) {
												SetErrorResponse(e.Response, (int) HttpStatusCode.Gone, new("GameAlreadyStarted", "The game has already started."));
												return;
											}

											player = new Player(name, clientToken);
											if (!game.TryAddPlayer(player, out playerIndex, out var error)) {
												SetErrorResponse(e.Response, error.Code == "GameAlreadyStarted" ? (int) HttpStatusCode.Gone : 422, error);
												return;
											}
										}
										// If they're already in the game, resend the original join response instead of an error.
										SetResponse(e.Response, (int) HttpStatusCode.OK, "application/json", JsonConvert.SerializeObject(new { playerIndex, clientToken }));
										game.SendEvent("join", new { playerIndex, player }, false);
										timer.Start();
									} catch (ArgumentException) {
										e.Response.StatusCode = (int) HttpStatusCode.BadRequest;
									}
								}
								break;
							}
							case "chooseDeck": {
								if (e.Request.HttpMethod != "POST") {
									e.Response.StatusCode = (int) HttpStatusCode.MethodNotAllowed;
									e.Response.AddHeader("Allow", "POST");
								} else if (e.Request.ContentLength64 >= 65536) {
									e.Response.StatusCode = (int) HttpStatusCode.RequestEntityTooLarge;
								} else {
									try {
										var d = DecodeFormData(e.Request.InputStream);
										if (!d.TryGetValue("clientToken", out var tokenString) || !Guid.TryParse(tokenString, out var clientToken)) {
											SetErrorResponse(e.Response, (int) HttpStatusCode.BadRequest, new("InvalidClientToken", "Invalid client token."));
											return;
										}
										if (!game.GetPlayer(clientToken, out var playerIndex, out var player)) {
											SetErrorResponse(e.Response, (int) HttpStatusCode.UnprocessableEntity, new("NotInGame", "You're not in the game."));
											return;
										}
										if (player.Deck != null) {
											SetErrorResponse(e.Response, (int) HttpStatusCode.Conflict, new("DeckAlreadyChosen", "You've already chosen a deck."));
											return;
										}

										if (!d.TryGetValue("deckName", out var deckName)) {
											SetErrorResponse(e.Response, (int) HttpStatusCode.BadRequest, new("InvalidDeckName", "Missing deck name."));
											return;
										}
										if (!d.TryGetValue("deckCards", out var deckString)) {
											SetErrorResponse(e.Response, (int) HttpStatusCode.BadRequest, new("InvalidDeckCards", "Missing deck cards."));
											return;
										}
										var array = deckString.Split(new[] { ',', '+', ' ' }, 15);
										if (array.Length != 15) {
											SetErrorResponse(e.Response, (int) HttpStatusCode.UnprocessableEntity, new("InvalidDeckCards", "Invalid deck list."));
											return;
										}
										var cards = new int[15];
										for (int i = 0; i < 15; i++) {
											if (!int.TryParse(array[i], out var cardNumber) || cardNumber < 0 || cardNumber > CardDatabase.Cards.Count) {
												SetErrorResponse(e.Response, (int) HttpStatusCode.UnprocessableEntity, new("InvalidDeckCards", "Invalid deck list."));
												return;
											}
											if (Array.IndexOf(cards, cardNumber, 0, i) >= 0) {
												SetErrorResponse(e.Response, (int) HttpStatusCode.UnprocessableEntity, new("InvalidDeckCards", "Deck cannot have duplicates."));
												return;
											}
											cards[i] = cardNumber;
										}

										player.Deck = cards.Select(CardDatabase.GetCard).ToArray();
										e.Response.StatusCode = (int) HttpStatusCode.NoContent;
										game.SendPlayerReadyEvent(playerIndex);
										timer.Start();
									} catch (ArgumentException) {
										e.Response.StatusCode = (int) HttpStatusCode.BadRequest;
									}
								}
								break;
							}
							case "play": {
								if (e.Request.HttpMethod != "POST") {
									e.Response.StatusCode = (int) HttpStatusCode.MethodNotAllowed;
									e.Response.AddHeader("Allow", "POST");
								} else if (e.Request.ContentLength64 >= 65536) {
									e.Response.StatusCode = (int) HttpStatusCode.RequestEntityTooLarge;
								} else {
									try {
										var d = DecodeFormData(e.Request.InputStream);
										Guid clientToken;
										if (!d.TryGetValue("clientToken", out var tokenString) || !Guid.TryParse(tokenString, out clientToken)) {
											SetResponse(e.Response, (int) HttpStatusCode.BadRequest, "text/plain", "Invalid client token");
											return;
										}
										if (game.State != GameState.Ongoing) {
											SetResponse(e.Response, (int) HttpStatusCode.Gone, "text/plain", "You can't do that in this game state.");
											return;
										}
										if (!game.GetPlayer(clientToken, out var playerIndex, out var player)) {
											SetErrorResponse(e.Response, (int) HttpStatusCode.UnprocessableEntity, new("NotInGame", "You're not in the game."));
											return;
										}

										if (player!.Move != null) {
											SetResponse(e.Response, (int) HttpStatusCode.Conflict, "text/plain", "You've already chosen a move.");
											return;
										}

										if (!d.TryGetValue("cardNumber", out var cardNumberStr) || !int.TryParse(cardNumberStr, out var cardNumber)) {
											SetResponse(e.Response, (int) HttpStatusCode.UnprocessableEntity, "text/plain", "Missing or invalid card number");
											return;
										}

										var handIndex = player.GetHandIndex(cardNumber);
										if (handIndex < 0) {
											SetResponse(e.Response, (int) HttpStatusCode.UnprocessableEntity, "text/plain", "You don't have that card");
											return;
										}

										var card = player.Hand![handIndex];
										if (d.TryGetValue("isPass", out var isPassStr) && isPassStr.ToLower() is not ("false" or "0")) {
											player.Move = new(card, true, 0, 0, 0, false);
										} else {
											var isSpecialAttack = d.TryGetValue("isSpecialAttack", out var isSpecialAttackStr) && isSpecialAttackStr.ToLower() is not ("false" or "0");
											if (!d.TryGetValue("x", out var xs) || !int.TryParse(xs, out var x)
												|| !d.TryGetValue("y", out var ys) || !int.TryParse(ys, out var y)
												|| !d.TryGetValue("r", out var rs) || !int.TryParse(rs, out var r)) {
												SetResponse(e.Response, (int) HttpStatusCode.BadRequest, "text/plain", "Missing or invalid coordinates");
												return;
											}
											r &= 3;
											if (!game.CanPlay(playerIndex, card, x, y, r, isSpecialAttack)) {
												SetResponse(e.Response, (int) HttpStatusCode.UnprocessableEntity, "text/plain", "Illegal move");
												return;
											}
											player.Move = new(card, false, x, y, r, isSpecialAttack);
										}
										e.Response.StatusCode = (int) HttpStatusCode.NoContent;
										game.SendPlayerReadyEvent(playerIndex);
										timer.Start();
									} catch (ArgumentException) {
										e.Response.StatusCode = (int) HttpStatusCode.BadRequest;
									}
								}
								break;
							}
							case "redraw": {
								if (e.Request.HttpMethod != "POST") {
									e.Response.StatusCode = (int) HttpStatusCode.MethodNotAllowed;
									e.Response.AddHeader("Allow", "POST");
								} else if (e.Request.ContentLength64 >= 65536) {
									e.Response.StatusCode = (int) HttpStatusCode.RequestEntityTooLarge;
								} else {
									try {
										if (game.State != GameState.Redraw) {
											SetResponse(e.Response, (int) HttpStatusCode.Gone, "text/plain", "You can't do that in this game state.");
											return;
										}

										var d = DecodeFormData(e.Request.InputStream);
										if (!d.TryGetValue("clientToken", out var tokenString) || !Guid.TryParse(tokenString, out var clientToken)) {
											SetResponse(e.Response, (int) HttpStatusCode.BadRequest, "text/plain", "Invalid client token");
											return;
										}
										if (!game.GetPlayer(clientToken, out var playerIndex, out var player)) {
											SetResponse(e.Response, (int) HttpStatusCode.UnprocessableEntity, "text/plain", "You're not in the game.");
											return;
										}

										if (player.Move != null) {
											SetResponse(e.Response, (int) HttpStatusCode.Conflict, "text/plain", "You've already chosen a move.");
											return;
										}

										var redraw = d.TryGetValue("redraw", out var redrawStr) && redrawStr.ToLower() is not ("false" or "0");
										player.Move = new(player.Hand![0], false, 0, 0, 0, redraw);
										e.Response.StatusCode = (int) HttpStatusCode.NoContent;
										game.SendPlayerReadyEvent(playerIndex);
										timer.Start();
									} catch (ArgumentException) {
										e.Response.StatusCode = (int) HttpStatusCode.BadRequest;
									}
								}
								break;
							}
							default:
								SetResponse(e.Response, (int) HttpStatusCode.NotFound, "text/plain", "Endpoint not found");
								break;
						}
					}
				}
			} else {
				SetResponse(e.Response, (int) HttpStatusCode.NotFound, "text/plain", "Endpoint not found");
			}
		}
	}

	private static void SetErrorResponse(WebSocketSharp.Net.HttpListenerResponse response, int statusCode, Error error) {
		var bytes = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(error));
		SetResponse(response, statusCode, "application/json", bytes);
	}
	private static void SetResponse(WebSocketSharp.Net.HttpListenerResponse response, int statusCode, string contentType, string content) {
		var bytes = Encoding.UTF8.GetBytes(content);
		SetResponse(response, statusCode, contentType, bytes);
	}
	private static void SetResponse(WebSocketSharp.Net.HttpListenerResponse response, int statusCode, string contentType, byte[] content) {
		response.StatusCode = statusCode;
		response.ContentType = contentType;
		response.ContentLength64 = content.Length;
		response.Close(content, true);
	}

	private static Dictionary<string, string> DecodeFormData(Stream stream) {
		using var reader = new StreamReader(stream);
		var s = reader.ReadToEnd();
		return s != ""
			? s.Split(new[] { '&' }).Select(s => s.Split('=')).Select(a => a.Length == 2 ? a : throw new ArgumentException("Invalid form data"))
				.ToDictionary(a => HttpUtility.UrlDecode(a[0]), a => HttpUtility.UrlDecode(a[1]))
			: new();
	}
}
