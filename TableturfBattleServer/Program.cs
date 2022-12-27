using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Net;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Timers;
using System.Web;

using Newtonsoft.Json;

using TableturfBattleServer.DTO;

using WebSocketSharp.Server;

using HttpListenerRequest = WebSocketSharp.Net.HttpListenerRequest;
using HttpListenerResponse = WebSocketSharp.Net.HttpListenerResponse;
using Timer = System.Timers.Timer;

namespace TableturfBattleServer;

internal class Program {
	internal static HttpServer? httpServer;

	internal static Dictionary<Guid, Game> games = new();
	internal static Dictionary<Guid, Game> inactiveGames = new();
	internal static readonly Timer timer = new(500);
	private static bool lockdown;

	private const int InactiveGameLimit = 1000;
	private static readonly TimeSpan InactiveGameTimeout = TimeSpan.FromMinutes(5);

	private static string? GetClientRootPath() {
		var directory = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
		while (true) {
			if (directory == null) return null;
			var directory2 = Path.Combine(directory, "TableturfBattleClient");
			if (Directory.Exists(directory2)) return directory2;
			directory = Path.GetDirectoryName(directory);
		}
	}

	internal static void Main(string[] args) {
		httpServer = new(args.Contains("--open") ? IPAddress.Any : IPAddress.Loopback, 3333) { DocumentRootPath = GetClientRootPath() };

		timer.Elapsed += Timer_Elapsed;

		httpServer.AddWebSocketService<TableturfWebSocketBehaviour>("/api/websocket");
		httpServer.OnGet += HttpServer_OnRequest;
		httpServer.OnPost += HttpServer_OnRequest;
		httpServer.Start();
		Console.WriteLine($"Listening on http://{httpServer.Address}:{httpServer.Port}");
		if (httpServer.DocumentRootPath != null)
			Console.WriteLine($"Serving client files from {httpServer.DocumentRootPath}");
		else
			Console.WriteLine($"Client files were not found.");

		while (true) {
			var s = Console.ReadLine();
			if (s == null)
				Thread.Sleep(Timeout.Infinite);
			else {
				s = s.Trim().ToLower();
				if (s == "update") {
					if (games.Count == 0)
						Environment.Exit(2);
					lockdown = true;
					Console.WriteLine("Locking server for update.");
				}
			}
				
		}
	}

	private static void Timer_Elapsed(object? sender, ElapsedEventArgs e) {
		lock (games) {
			foreach (var (id, game) in games) {
				lock (game.Players) {
					game.Tick();
					if (DateTime.UtcNow - game.AbandonedSince >= InactiveGameTimeout) {
						games.Remove(id);
						inactiveGames.Add(id, game);
						Console.WriteLine($"{games.Count} games active; {inactiveGames.Count} inactive");
						if (lockdown && games.Count == 0)
							Environment.Exit(2);
					}
				}
			}
			if (inactiveGames.Count >= InactiveGameLimit) {
				foreach (var (k, _) in inactiveGames.Select(e => (e.Key, e.Value.AbandonedSince)).OrderBy(e => e.AbandonedSince).Take(InactiveGameLimit / 2))
					inactiveGames.Remove(k);
				Console.WriteLine($"{games.Count} games active; {inactiveGames.Count} inactive");
			}
		}
	}

	private static void HttpServer_OnRequest(object? sender, HttpRequestEventArgs e) {
		e.Response.AppendHeader("Access-Control-Allow-Origin", "*");
		if (!e.Request.RawUrl.StartsWith("/api/")) {
			var path = e.Request.RawUrl == "/" || e.Request.RawUrl.StartsWith("/game/") || e.Request.RawUrl.StartsWith("/replay/")
				? "index.html"
				: e.Request.RawUrl[1..];
			if (e.TryReadFile(path, out var bytes))
				SetResponse(e.Response, HttpStatusCode.OK,
					Path.GetExtension(path) switch {
						".html" or ".htm" => "text/html",
						".css" => "text/css",
						".js" => "text/javascript",
						".png" => "image/png",
						".woff" or ".woff2" => "font/woff",
						_ => "application/octet-stream"
					}, bytes);
			else
				SetErrorResponse(e.Response, new(HttpStatusCode.NotFound, "NotFound", "File not found."));
			return;
		} else if (e.Request.RawUrl == "/api/games/new") {
			if (e.Request.HttpMethod != "POST") {
				e.Response.AddHeader("Allow", "POST");
				SetErrorResponse(e.Response, new(HttpStatusCode.MethodNotAllowed, "MethodNotAllowed", "Invalid request method for this endpoint."));
			} else if (lockdown) {
				SetErrorResponse(e.Response, new(HttpStatusCode.ServiceUnavailable, "ServerLocked", "The server is temporarily locked for an update. Please try again soon."));
			} else if (e.Request.ContentLength64 >= 65536) {
				e.Response.StatusCode = (int) HttpStatusCode.RequestEntityTooLarge;
			} else {
				try {
					var d = DecodeFormData(e.Request.InputStream);
					Guid clientToken;
					if (!d.TryGetValue("name", out var name)) {
						SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidName", "Missing name."));
						return;
					}
					var maxPlayers = 2;
					if (d.TryGetValue("maxPlayers", out var maxPlayersString)) {
						if (!int.TryParse(maxPlayersString, out maxPlayers) || maxPlayers < 2 || maxPlayers > 4) {
							SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidMaxPlayers", "Invalid player limit."));
							return;
						}
					}
					if (d.TryGetValue("clientToken", out var tokenString) && tokenString != "") {
						if (!Guid.TryParse(tokenString, out clientToken)) {
							SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidClientToken", "Invalid client token."));
							return;
						}
					} else
						clientToken = Guid.NewGuid();
					var game = new Game(maxPlayers);
					game.Players.Add(new(game, name, clientToken));
					games.Add(game.ID, game);
					timer.Start();

					SetResponse(e.Response, HttpStatusCode.OK, "application/json", JsonConvert.SerializeObject(new { gameID = game.ID, clientToken, maxPlayers }));
					Console.WriteLine($"New game started: {game.ID}; {games.Count} games active; {inactiveGames.Count} inactive");
				} catch (ArgumentException) {
					SetErrorResponse(e.Response, new(HttpStatusCode.BadRequest, "InvalidRequestData", "Invalid form data"));
				}
			}
		} else if (e.Request.RawUrl == "/api/cards") {
			SetStaticResponse(e.Request, e.Response, CardDatabase.JSON, CardDatabase.Version.ToString(), CardDatabase.LastModified);
		} else if (e.Request.RawUrl == "/api/stages") {
			SetStaticResponse(e.Request, e.Response, StageDatabase.JSON, StageDatabase.Version.ToString(), StageDatabase.LastModified);
		} else {
			var m = Regex.Match(e.Request.RawUrl, @"^/api/games/([\w-]+)(?:/(\w+)(?:\?clientToken=([\w-]+))?)?$", RegexOptions.Compiled);
			if (m.Success) {
				if (!Guid.TryParse(m.Groups[1].Value, out var gameID)) {
					SetErrorResponse(e.Response, new(HttpStatusCode.BadRequest, "InvalidGameID", "Invalid game ID."));
					return;
				}
				lock (games) {
					if (!games.TryGetValue(gameID, out var game) && !inactiveGames.TryGetValue(gameID, out game)) {
						SetErrorResponse(e.Response, new(HttpStatusCode.NotFound, "GameNotFound", "Game not found."));
						return;
					}
					lock (game.Players) {
						switch (m.Groups[2].Value) {
							case "": {
								if (e.Request.HttpMethod is not ("GET" or "HEAD")) {
									e.Response.AddHeader("Allow", "GET, HEAD");
									SetErrorResponse(e.Response, new(HttpStatusCode.MethodNotAllowed, "MethodNotAllowed", "Invalid request method for this endpoint."));
									return;
								}
								SetResponse(e.Response, HttpStatusCode.OK, "application/json", JsonConvert.SerializeObject(game));
								break;
							}
							case "playerData": {
								if (e.Request.HttpMethod is not ("GET" or "HEAD")) {
									e.Response.AddHeader("Allow", "GET, HEAD");
									SetErrorResponse(e.Response, new(HttpStatusCode.MethodNotAllowed, "MethodNotAllowed", "Invalid request method for this endpoint."));
									return;
								}

								if (!Guid.TryParse(m.Groups[3].Value, out var clientToken))
									clientToken = Guid.Empty;

								SetResponse(e.Response, HttpStatusCode.OK, "application/json", JsonConvert.SerializeObject(new {
									game,
									playerData = game.GetPlayer(clientToken, out var playerIndex, out var player)
										? new PlayerData(playerIndex, player)
										: null
								}));
								break;
							}

							case "join": {
								if (e.Request.HttpMethod != "POST") {
									e.Response.AddHeader("Allow", "POST");
									SetErrorResponse(e.Response, new(HttpStatusCode.MethodNotAllowed, "MethodNotAllowed", "Invalid request method for this endpoint."));
								} else if (e.Request.ContentLength64 >= 65536) {
									e.Response.StatusCode = (int) HttpStatusCode.RequestEntityTooLarge;
								} else {
									try {
										var d = DecodeFormData(e.Request.InputStream);
										Guid clientToken;
										if (!d.TryGetValue("name", out var name)) {
											SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidName", "Missing name."));
											return;
										}
										if (d.TryGetValue("clientToken", out var tokenString) && tokenString != "") {
											if (!Guid.TryParse(tokenString, out clientToken)) {
												SetErrorResponse(e.Response, new(HttpStatusCode.BadRequest, "InvalidClientToken", "Invalid client token."));
												return;
											}
										} else
											clientToken = Guid.NewGuid();

										if (!game.GetPlayer(clientToken, out var playerIndex, out var player)) {
											if (game.State != GameState.WaitingForPlayers) {
												SetErrorResponse(e.Response, new(HttpStatusCode.Gone, "GameAlreadyStarted", "The game has already started."));
												return;
											}

											player = new Player(game, name, clientToken);
											if (!game.TryAddPlayer(player, out playerIndex, out var error)) {
												SetErrorResponse(e.Response, error);
												return;
											}

											game.SendEvent("join", new { playerIndex, player }, false);
										}
										// If they're already in the game, resend the original join response instead of an error.
										SetResponse(e.Response, HttpStatusCode.OK, "application/json", JsonConvert.SerializeObject(new { playerIndex, clientToken }));
										timer.Start();
									} catch (ArgumentException) {
										SetErrorResponse(e.Response, new(HttpStatusCode.BadRequest, "InvalidRequestData", "Invalid form data"));
									}
								}
								break;
							}
							case "chooseStage": {
								if (e.Request.HttpMethod != "POST") {
									e.Response.AddHeader("Allow", "POST");
									SetErrorResponse(e.Response, new(HttpStatusCode.MethodNotAllowed, "MethodNotAllowed", "Invalid request method for this endpoint."));
								} else if (e.Request.ContentLength64 >= 65536) {
									e.Response.StatusCode = (int) HttpStatusCode.RequestEntityTooLarge;
								} else {
									var d = DecodeFormData(e.Request.InputStream);
									if (!d.TryGetValue("clientToken", out var tokenString) || !Guid.TryParse(tokenString, out var clientToken)) {
										SetErrorResponse(e.Response, new(HttpStatusCode.BadRequest, "InvalidClientToken", "Invalid client token."));
										return;
									}
									if (!game.GetPlayer(clientToken, out var playerIndex, out var player)) {
										SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "NotInGame", "You're not in the game."));
										return;
									}
									if (player.selectedStageIndex != null) {
										SetErrorResponse(e.Response, new(HttpStatusCode.Conflict, "StageAlreadyChosen", "You've already chosen a stage."));
										return;
									}

									if (!d.TryGetValue("stage", out var stageName)) {
										SetErrorResponse(e.Response, new(HttpStatusCode.BadRequest, "InvalidStage", "Missing stage name."));
										return;
									}

									if (stageName == "random") {
										player.selectedStageIndex = -1;
										e.Response.StatusCode = (int) HttpStatusCode.NoContent;
										game.SendPlayerReadyEvent(playerIndex);
										timer.Start();
										return;
									} else {
										for (var i = 0; i < StageDatabase.Stages.Count; i++) {
											var stage = StageDatabase.Stages[i];
											if (stageName == stage.Name) {
												player.selectedStageIndex = i;
												e.Response.StatusCode = (int) HttpStatusCode.NoContent;
												game.SendPlayerReadyEvent(playerIndex);
												timer.Start();
												return;
											}
										}
									}
									SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "StageNotFound", "No such stage is known."));
								}
								break;
							}
							case "chooseDeck": {
								if (e.Request.HttpMethod != "POST") {
									e.Response.AddHeader("Allow", "POST");
									SetErrorResponse(e.Response, new(HttpStatusCode.MethodNotAllowed, "MethodNotAllowed", "Invalid request method for this endpoint."));
								} else if (e.Request.ContentLength64 >= 65536) {
									e.Response.StatusCode = (int) HttpStatusCode.RequestEntityTooLarge;
								} else {
									try {
										var d = DecodeFormData(e.Request.InputStream);
										if (!d.TryGetValue("clientToken", out var tokenString) || !Guid.TryParse(tokenString, out var clientToken)) {
											SetErrorResponse(e.Response, new(HttpStatusCode.BadRequest, "InvalidClientToken", "Invalid client token."));
											return;
										}
										if (!game.GetPlayer(clientToken, out var playerIndex, out var player)) {
											SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "NotInGame", "You're not in the game."));
											return;
										}
										if (player.Deck != null) {
											SetErrorResponse(e.Response, new(HttpStatusCode.Conflict, "DeckAlreadyChosen", "You've already chosen a deck."));
											return;
										}

										if (!d.TryGetValue("deckName", out var deckName)) {
											SetErrorResponse(e.Response, new(HttpStatusCode.BadRequest, "InvalidDeckName", "Missing deck name."));
											return;
										}
										if (!d.TryGetValue("deckCards", out var deckString)) {
											SetErrorResponse(e.Response, new(HttpStatusCode.BadRequest, "InvalidDeckCards", "Missing deck cards."));
											return;
										}
										var array = deckString.Split(new[] { ',', '+', ' ' }, 15);
										if (array.Length != 15) {
											SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidDeckCards", "Invalid deck list."));
											return;
										}
										var cards = new int[15];
										for (int i = 0; i < 15; i++) {
											if (!int.TryParse(array[i], out var cardNumber) || cardNumber < 0 || cardNumber > CardDatabase.Cards.Count) {
												SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidDeckCards", "Invalid deck list."));
												return;
											}
											if (Array.IndexOf(cards, cardNumber, 0, i) >= 0) {
												SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidDeckCards", "Deck cannot have duplicates."));
												return;
											}
											cards[i] = cardNumber;
										}

										if (d.TryGetValue("stageIndex", out var stageIndexString) && stageIndexString is not ("" or "null" or "undefined")) {
											if (int.TryParse(stageIndexString, out var stageIndex) && stageIndex >= 0 && stageIndex < StageDatabase.Stages.Count)
												player.selectedStageIndex = stageIndex;
											else {
												SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidStage", "Invalid stage index."));
												return;
											}
										}

										player.Deck = cards.Select(CardDatabase.GetCard).ToArray();
										e.Response.StatusCode = (int) HttpStatusCode.NoContent;
										game.SendPlayerReadyEvent(playerIndex);
										timer.Start();
									} catch (ArgumentException) {
										SetErrorResponse(e.Response, new(HttpStatusCode.BadRequest, "InvalidRequestData", "Invalid form data"));
									}
								}
								break;
							}
							case "play": {
								if (e.Request.HttpMethod != "POST") {
									e.Response.AddHeader("Allow", "POST");
									SetErrorResponse(e.Response, new(HttpStatusCode.MethodNotAllowed, "MethodNotAllowed", "Invalid request method for this endpoint."));
								} else if (e.Request.ContentLength64 >= 65536) {
									e.Response.StatusCode = (int) HttpStatusCode.RequestEntityTooLarge;
								} else {
									try {
										var d = DecodeFormData(e.Request.InputStream);
										if (!d.TryGetValue("clientToken", out var tokenString) || !Guid.TryParse(tokenString, out var clientToken)) {
											SetErrorResponse(e.Response, new(HttpStatusCode.BadRequest, "InvalidClientToken", "Invalid client token."));
											return;
										}
										if (game.State != GameState.Ongoing) {
											SetErrorResponse(e.Response, new(HttpStatusCode.Conflict, "GameNotSetUp", "You can't do that in this game state."));
											return;
										}
										if (!game.GetPlayer(clientToken, out var playerIndex, out var player)) {
											SetErrorResponse(e.Response, new(HttpStatusCode.Forbidden, "NotInGame", "You're not in the game."));
											return;
										}

										if (player.Move != null) {
											SetErrorResponse(e.Response, new(HttpStatusCode.Conflict, "MoveAlreadyChosen", "You've already chosen a move."));
											return;
										}

										if (!d.TryGetValue("cardNumber", out var cardNumberStr) || !int.TryParse(cardNumberStr, out var cardNumber)) {
											SetErrorResponse(e.Response, new(HttpStatusCode.BadRequest, "InvalidCard", "Missing or invalid card number."));
											return;
										}

										var handIndex = player.GetHandIndex(cardNumber);
										if (handIndex < 0) {
											SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "MissingCard", "You don't have that card."));
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
												SetErrorResponse(e.Response, new(HttpStatusCode.BadRequest, "InvalidPosition", "Missing or invalid position."));
												return;
											}
											r &= 3;
											if (!game.CanPlay(playerIndex, card, x, y, r, isSpecialAttack)) {
												SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "IllegalMove", "Illegal move"));
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
									e.Response.AddHeader("Allow", "POST");
									SetErrorResponse(e.Response, new(HttpStatusCode.MethodNotAllowed, "MethodNotAllowed", "Invalid request method for this endpoint."));
								} else if (e.Request.ContentLength64 >= 65536) {
									e.Response.StatusCode = (int) HttpStatusCode.RequestEntityTooLarge;
								} else {
									try {
										if (game.State != GameState.Redraw) {
											SetErrorResponse(e.Response, new(HttpStatusCode.Conflict, "GameNotSetUp", "You can't do that in this game state."));
											return;
										}

										var d = DecodeFormData(e.Request.InputStream);
										if (!d.TryGetValue("clientToken", out var tokenString) || !Guid.TryParse(tokenString, out var clientToken)) {
											SetErrorResponse(e.Response, new(HttpStatusCode.BadRequest, "InvalidClientToken", "Invalid client token."));
											return;
										}
										if (!game.GetPlayer(clientToken, out var playerIndex, out var player)) {
											SetErrorResponse(e.Response, new(HttpStatusCode.Forbidden, "NotInGame", "You're not in the game."));
											return;
										}

										if (player.Move != null) {
											SetErrorResponse(e.Response, new(HttpStatusCode.Conflict, "MoveAlreadyChosen", "You've already chosen a move."));
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
							case "replay": {
								if (e.Request.HttpMethod != "GET") {
									e.Response.AddHeader("Allow", "GET");
									SetErrorResponse(e.Response, new(HttpStatusCode.MethodNotAllowed, "MethodNotAllowed", "Invalid request method for this endpoint."));
								} else {
									if (game.State != GameState.Ended) {
										SetErrorResponse(e.Response, new(HttpStatusCode.Conflict, "GameInProgress", "You can't see the replay until the game has ended."));
										return;
									}
									var ms = new MemoryStream();
									game.WriteReplayData(ms);
									SetResponse(e.Response, HttpStatusCode.OK, "application/octet-stream", ms.ToArray());
								}
								break;
							}
							default:
								SetErrorResponse(e.Response, new(HttpStatusCode.NotFound, "NotFound", "Endpoint not found."));
								break;
						}
					}
				}
			} else
				SetErrorResponse(e.Response, new(HttpStatusCode.NotFound, "NotFound", "Endpoint not found."));
		}
	}

	private static void SetErrorResponse(HttpListenerResponse response, Error error) {
		var bytes = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(error));
		SetResponse(response, error.HttpStatusCode, "application/json", bytes);
	}
	private static void SetResponse(HttpListenerResponse response, HttpStatusCode statusCode, string contentType, string content) {
		var bytes = Encoding.UTF8.GetBytes(content);
		SetResponse(response, statusCode, contentType, bytes);
	}
	private static void SetResponse(HttpListenerResponse response, HttpStatusCode statusCode, string contentType, byte[] content) {
		response.StatusCode = (int) statusCode;
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

	private static void SetStaticResponse(HttpListenerRequest request, HttpListenerResponse response, string jsonContent, string eTag, DateTime lastModified) {
		if (request.HttpMethod is not ("GET" or "HEAD")) {
			response.AddHeader("Allow", "GET, HEAD");
			SetErrorResponse(response, new(HttpStatusCode.MethodNotAllowed, "MethodNotAllowed", "Invalid request method for this endpoint."));
			return;
		}
		response.AppendHeader("Cache-Control", "max-age=86400");
		response.AppendHeader("ETag", eTag);
		response.AppendHeader("Last-Modified", lastModified.ToString("ddd, dd MMM yyyy HH:mm:ss \"GMT\""));

		var ifNoneMatch = request.Headers["If-None-Match"];
		if (ifNoneMatch != null) {
			if (request.Headers["If-None-Match"] == eTag)
				response.StatusCode = (int) HttpStatusCode.NotModified;
			else
				SetResponse(response, HttpStatusCode.OK, "application/json", jsonContent);
		} else {
			if (DateTime.TryParseExact(request.Headers["If-Modified-Since"], "ddd, dd MMM yyyy HH:mm:ss \"GMT\"", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var dateTime)
				&& dateTime >= lastModified.ToUniversalTime())
				response.StatusCode = (int) HttpStatusCode.NotModified;
			else
				SetResponse(response, HttpStatusCode.OK, "application/json", jsonContent);
		}
	}

	internal static bool TryGetGame(Guid gameID, [MaybeNullWhen(false)] out Game game) {
		if (games.TryGetValue(gameID, out game)) {
			game.AbandonedSince = DateTime.UtcNow;
			return true;
		} else if (inactiveGames.TryGetValue(gameID, out game)) {
			inactiveGames.Remove(gameID);
			games[gameID] = game;
			game.AbandonedSince = DateTime.UtcNow;
			return true;
		}
		return false;
	}
}
