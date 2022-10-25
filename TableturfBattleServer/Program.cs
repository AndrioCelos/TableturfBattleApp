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
	internal static readonly Timer timer = new(500);

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
		if (!e.Request.RawUrl.StartsWith("/api/")) {
			var path = e.Request.RawUrl == "/" || e.Request.RawUrl.StartsWith("/game/") ? "index.html" : e.Request.RawUrl[1..];
			if (e.TryReadFile(path, out var bytes))
				SetResponse(e.Response, 200,
					Path.GetExtension(path) switch {
						".html" or ".htm" => "text/html",
						".css" => "text/css",
						".js" => "text/javascript",
						".png" => "image/png",
						".woff" or ".woff2" => "font/woff",
						_ => "application/octet-stream"
					}, bytes);
			else
				SetErrorResponse(e.Response, 404, new("FileNotFound", "File not found."));
			return;
		} else if (e.Request.RawUrl == "/api/games/new") {
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
					var maxPlayers = 2;
					if (d.TryGetValue("maxPlayers", out var maxPlayersString)) {
						if (!int.TryParse(maxPlayersString, out maxPlayers) || maxPlayers < 2 || maxPlayers > 4) {
							SetErrorResponse(e.Response, (int) HttpStatusCode.UnprocessableEntity, new("InvalidMaxPlayers", "Invalid player limit."));
							return;
						}
					}
					if (d.TryGetValue("clientToken", out var tokenString) && tokenString != "") {
						if (!Guid.TryParse(tokenString, out clientToken)) {
							SetErrorResponse(e.Response, (int) HttpStatusCode.UnprocessableEntity, new("InvalidClientToken", "Invalid client token."));
							return;
						}
					} else
						clientToken = Guid.NewGuid();
					var game = new Game(maxPlayers);
					game.Players.Add(new(game, name, clientToken));
					games.Add(game.ID, game);

					SetResponse(e.Response, (int) HttpStatusCode.OK, "application/json", JsonConvert.SerializeObject(new { gameID = game.ID, clientToken, maxPlayers }));
				} catch (ArgumentException) {
					e.Response.StatusCode = (int) HttpStatusCode.BadRequest;
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
										? new PlayerData(playerIndex, player)
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

											player = new Player(game, name, clientToken);
											if (!game.TryAddPlayer(player, out playerIndex, out var error)) {
												SetErrorResponse(e.Response, error.Code == "GameAlreadyStarted" ? (int) HttpStatusCode.Gone : 422, error);
												return;
											}

											game.SendEvent("join", new { playerIndex, player }, false);
										}
										// If they're already in the game, resend the original join response instead of an error.
										SetResponse(e.Response, (int) HttpStatusCode.OK, "application/json", JsonConvert.SerializeObject(new { playerIndex, clientToken }));
										timer.Start();
									} catch (ArgumentException) {
										e.Response.StatusCode = (int) HttpStatusCode.BadRequest;
									}
								}
								break;
							}
							case "chooseStage": {
								if (e.Request.HttpMethod != "POST") {
									e.Response.StatusCode = (int) HttpStatusCode.MethodNotAllowed;
									e.Response.AddHeader("Allow", "POST");
								} else if (e.Request.ContentLength64 >= 65536) {
									e.Response.StatusCode = (int) HttpStatusCode.RequestEntityTooLarge;
								} else {
									var d = DecodeFormData(e.Request.InputStream);
									if (!d.TryGetValue("clientToken", out var tokenString) || !Guid.TryParse(tokenString, out var clientToken)) {
										SetErrorResponse(e.Response, (int) HttpStatusCode.BadRequest, new("InvalidClientToken", "Invalid client token."));
										return;
									}
									if (!game.GetPlayer(clientToken, out var playerIndex, out var player)) {
										SetErrorResponse(e.Response, (int) HttpStatusCode.UnprocessableEntity, new("NotInGame", "You're not in the game."));
										return;
									}
									if (player.selectedStageIndex != null) {
										SetErrorResponse(e.Response, (int) HttpStatusCode.Conflict, new("StageAlreadyChosen", "You've already chosen a stage."));
										return;
									}

									if (!d.TryGetValue("stage", out var stageName)) {
										SetErrorResponse(e.Response, (int) HttpStatusCode.BadRequest, new("InvalidStage", "Missing stage name."));
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
									SetErrorResponse(e.Response, (int) HttpStatusCode.UnprocessableEntity, new("StageNotFound", "No such stage is known."));
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

										if (d.TryGetValue("stageIndex", out var stageIndexString) && stageIndexString is not ("" or "null" or "undefined")) {
											if (int.TryParse(stageIndexString, out var stageIndex) && stageIndex >= 0 && stageIndex < StageDatabase.Stages.Count)
												player.selectedStageIndex = stageIndex;
											else {
												SetErrorResponse(e.Response, (int) HttpStatusCode.UnprocessableEntity, new("InvalidStage", "Invalid stage index."));
												return;
											}
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
										if (!d.TryGetValue("clientToken", out var tokenString) || !Guid.TryParse(tokenString, out var clientToken)) {
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

	private static void SetErrorResponse(HttpListenerResponse response, int statusCode, Error error) {
		var bytes = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(error));
		SetResponse(response, statusCode, "application/json", bytes);
	}
	private static void SetResponse(HttpListenerResponse response, int statusCode, string contentType, string content) {
		var bytes = Encoding.UTF8.GetBytes(content);
		SetResponse(response, statusCode, contentType, bytes);
	}
	private static void SetResponse(HttpListenerResponse response, int statusCode, string contentType, byte[] content) {
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

	private static void SetStaticResponse(HttpListenerRequest request, HttpListenerResponse response, string jsonContent, string eTag, DateTime lastModified) {
		if (request.HttpMethod is not ("GET" or "HEAD")) {
			response.StatusCode = (int) HttpStatusCode.MethodNotAllowed;
			response.AddHeader("Allow", "GET, HEAD");
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
				SetResponse(response, (int) HttpStatusCode.OK, "application/json", jsonContent);
		} else {
			if (DateTime.TryParseExact(request.Headers["If-Modified-Since"], "ddd, dd MMM yyyy HH:mm:ss \"GMT\"", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var dateTime)
				&& dateTime >= lastModified.ToUniversalTime())
				response.StatusCode = (int) HttpStatusCode.NotModified;
			else
				SetResponse(response, (int) HttpStatusCode.OK, "application/json", jsonContent);
		}
	}
}
