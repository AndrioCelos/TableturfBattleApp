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

internal partial class Program {
	internal static HttpServer? httpServer;

	internal static Dictionary<Guid, Game> games = [];
	internal static Dictionary<Guid, Game> inactiveGames = [];
	internal static readonly Timer timer = new(1000);
	private static bool lockdown;

	private const int InactiveGameLimit = 1000;
	private static readonly TimeSpan InactiveGameTimeout = TimeSpan.FromMinutes(5);
	internal static readonly char[] DELIMITERS = [',', ' '];
	internal const int CUSTOM_CARD_START = -10000;
	internal const int RECEIVED_CUSTOM_CARD_START = -20000;

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
					if (DateTime.UtcNow - game.abandonedSince >= InactiveGameTimeout) {
						games.Remove(id);
						inactiveGames.Add(id, game);
						Console.WriteLine($"{games.Count} games active; {inactiveGames.Count} inactive");
						if (lockdown && games.Count == 0)
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

	private static void HttpServer_OnRequest(object? sender, HttpRequestEventArgs e) {
		e.Response.AppendHeader("Access-Control-Allow-Origin", "*");
		if (!e.Request.RawUrl.StartsWith("/api/")) {
			var path = e.Request.RawUrl == "/" || e.Request.RawUrl.StartsWith("/deckeditor") || e.Request.RawUrl.StartsWith("/cardlist") || e.Request.RawUrl.StartsWith("/game/") || e.Request.RawUrl.StartsWith("/replay/")
				? "index.html"
				: HttpUtility.UrlDecode(e.Request.RawUrl[1..]);
			if (e.TryReadFile(path, out var bytes))
				SetResponse(e.Response, HttpStatusCode.OK,
					Path.GetExtension(path) switch {
						".html" or ".htm" => "text/html",
						".css" => "text/css",
						".js" => "text/javascript",
						".png" => "image/png",
						".webp" => "image/webp",
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
					if (name.Length > 32) {
						SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidName", "Name is too long."));
						return;
					}
					var maxPlayers = 2;
					if (d.TryGetValue("maxPlayers", out var maxPlayersString)) {
						if (!int.TryParse(maxPlayersString, out maxPlayers) || maxPlayers < 2 || maxPlayers > 4) {
							SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidMaxPlayers", "Invalid player limit."));
							return;
						}
					}
					int? turnTimeLimit = null;
					if (d.TryGetValue("turnTimeLimit", out var turnTimeLimitString) && turnTimeLimitString != "") {
						if (!int.TryParse(turnTimeLimitString, out var turnTimeLimit2) || turnTimeLimit2 < 10) {
							SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidTurnTimeLimit", "Invalid turn time limit."));
							return;
						}
						turnTimeLimit = turnTimeLimit2;
					}
					int? goalWinCount = null;
					if (d.TryGetValue("goalWinCount", out var goalWinCountString) && goalWinCountString != "") {
						if (!int.TryParse(goalWinCountString, out var goalWinCount2) || goalWinCount2 < 1) {
							SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidGoalWinCount", "Invalid goal win count."));
							return;
						}
						goalWinCount = goalWinCount2;
					}
					if (d.TryGetValue("clientToken", out var tokenString) && tokenString != "") {
						if (!Guid.TryParse(tokenString, out clientToken)) {
							SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidClientToken", "Invalid client token."));
							return;
						}
					} else
						clientToken = Guid.NewGuid();

					bool allowUpcomingCards;
					if (d.TryGetValue("allowUpcomingCards", out var allowUpcomingCardsString)) {
						if (!bool.TryParse(allowUpcomingCardsString, out allowUpcomingCards))
							SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidGameSettings", "allowUpcomingCards was invalid."));
					} else
						allowUpcomingCards = true;

					bool allowCustomCards;
					if (d.TryGetValue("allowCustomCards", out var allowCustomCardsString)) {
						if (!bool.TryParse(allowCustomCardsString, out allowCustomCards))
							SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidGameSettings", "allowCustomCards was invalid."));
					} else
						allowCustomCards = false;

					StageSelectionRules? stageSelectionRuleFirst = null, stageSelectionRuleAfterWin = null, stageSelectionRuleAfterDraw = null;
					if (d.TryGetValue("stageSelectionRuleFirst", out var json1)) {
						if (!TryParseStageSelectionRule(json1, out stageSelectionRuleFirst) || stageSelectionRuleFirst.Method is StageSelectionMethod.Same or StageSelectionMethod.Counterpick) {
							SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidGameSettings", "stageSelectionRuleFirst was invalid."));
							return;
						}
					} else
						stageSelectionRuleFirst = StageSelectionRules.Default;
					if (d.TryGetValue("stageSelectionRuleAfterWin", out var json2)) {
						if (!TryParseStageSelectionRule(json2, out stageSelectionRuleAfterWin)) {
							SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidGameSettings", "stageSelectionRuleAfterWin was invalid."));
							return;
						}
					} else
						stageSelectionRuleAfterWin = stageSelectionRuleFirst;
					if (d.TryGetValue("stageSelectionRuleAfterDraw", out var json3)) {
						if (!TryParseStageSelectionRule(json3, out stageSelectionRuleAfterDraw) || stageSelectionRuleAfterDraw.Method == StageSelectionMethod.Counterpick) {
							SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidGameSettings", "stageSelectionRuleAfterDraw was invalid."));
							return;
						}
					} else
						stageSelectionRuleAfterDraw = stageSelectionRuleFirst;

					var forceSameDeckAfterDraw = false;
					if (d.TryGetValue("forceSameDeckAfterDraw", out var forceSameDeckAfterDrawString)) {
						if (!bool.TryParse(forceSameDeckAfterDrawString, out forceSameDeckAfterDraw))
							SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidGameSettings", "forceSameDeckAfterDraw was invalid."));
					} else
						forceSameDeckAfterDraw = false;

					var spectate = false;
					if (d.TryGetValue("spectate", out var spectateString)) {
						if (!bool.TryParse(spectateString, out spectate))
							SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidGameSettings", "spectate was invalid."));
					} else
						spectate = false;

					var game = new Game(maxPlayers) { HostClientToken = clientToken, GoalWinCount = goalWinCount, TurnTimeLimit = turnTimeLimit, AllowUpcomingCards = allowUpcomingCards, AllowCustomCards = allowCustomCards, StageSelectionRuleFirst = stageSelectionRuleFirst, StageSelectionRuleAfterWin = stageSelectionRuleAfterWin, StageSelectionRuleAfterDraw = stageSelectionRuleAfterDraw, ForceSameDeckAfterDraw = forceSameDeckAfterDraw };
					if (!spectate)
						game.TryAddPlayer(new(game, name, clientToken), out _, out _);
					games.Add(game.ID, game);
					timer.Start();

					SetResponse(e.Response, HttpStatusCode.OK, "application/json", JsonUtils.Serialise(new { gameID = game.ID, clientToken, maxPlayers }));
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
			var m = GamePathRegex().Match(e.Request.RawUrl);
			if (m.Success) {
				if (!Guid.TryParse(m.Groups[1].Value, out var gameID)) {
					SetErrorResponse(e.Response, new(HttpStatusCode.BadRequest, "InvalidGameID", "Invalid game ID."));
					return;
				}
				lock (games) {
					if (!TryGetGame(gameID, out var game)) {
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
								SetResponse(e.Response, HttpStatusCode.OK, "application/json", JsonUtils.Serialise(game));
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

								SetResponse(e.Response, HttpStatusCode.OK, "application/json", JsonUtils.Serialise(new {
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
										if (name.Length > 32) {
											SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidName", "Name is too long."));
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
										SetResponse(e.Response, HttpStatusCode.OK, "application/json", JsonUtils.Serialise(new { playerIndex, clientToken }));
										timer.Start();
									} catch (ArgumentException) {
										SetErrorResponse(e.Response, new(HttpStatusCode.BadRequest, "InvalidRequestData", "Invalid form data"));
									}
								}
								break;
							}
							case "setGameSettings": {
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
									if (clientToken != game.HostClientToken) {
										SetErrorResponse(e.Response, new(HttpStatusCode.Forbidden, "AccessDenied", "Only the host can do that."));
										return;
									}
									if (game.State != GameState.WaitingForPlayers) {
										SetErrorResponse(e.Response, new(HttpStatusCode.Gone, "GameAlreadyStarted", "The game has already started."));
										return;
									}

									if (d.TryGetValue("turnTimeLimit", out var turnTimeLimitString)) {
										if (turnTimeLimitString == "")
											game.TurnTimeLimit = null;
										else if (!int.TryParse(turnTimeLimitString, out var turnTimeLimit2) || turnTimeLimit2 < 10) {
											SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidGameSettings", "Invalid turn time limit."));
											return;
										} else
											game.TurnTimeLimit = turnTimeLimit2;
									}

									if (d.TryGetValue("allowUpcomingCards", out var allowUpcomingCardsString)) {
										if (!bool.TryParse(allowUpcomingCardsString, out var allowUpcomingCards)) {
											SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidGameSettings", "Invalid allowUpcomingCards."));
											return;
										} else
											game.AllowUpcomingCards = allowUpcomingCards;
									}

									if (d.TryGetValue("allowCustomCards", out var allowCustomCardsString)) {
										if (!bool.TryParse(allowCustomCardsString, out var allowCustomCards)) {
											SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidGameSettings", "Invalid allowCustomCards."));
											return;
										} else
											game.AllowCustomCards = allowCustomCards;
									}

									game.SendEvent("settingsChange", game, false);
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
									if (!d.TryGetValue("stages", out var stagesString)) {
										SetErrorResponse(e.Response, new(HttpStatusCode.BadRequest, "InvalidStage", "Missing stages."));
										return;
									}

									var stages = new HashSet<int>();
									foreach (var field in stagesString.Split(DELIMITERS, StringSplitOptions.RemoveEmptyEntries)) {
										if (!int.TryParse(field, out var i)) {
											SetErrorResponse(e.Response, new(HttpStatusCode.BadRequest, "InvalidStage", "Invalid stages."));
											return;
										}
										stages.Add(i);
									}

									if (!game.TryChooseStages(player, stages, out var error)) {
										SetErrorResponse(e.Response, error);
										return;
									}

									e.Response.StatusCode = (int) HttpStatusCode.NoContent;
									game.SendPlayerReadyEvent(playerIndex, false);
									timer.Start();
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
										if (player.CurrentGameData.Deck != null) {
											SetErrorResponse(e.Response, new(HttpStatusCode.Conflict, "DeckAlreadyChosen", "You've already chosen a deck."));
											return;
										}

										if (!d.TryGetValue("deckName", out var deckName)) {
											SetErrorResponse(e.Response, new(HttpStatusCode.BadRequest, "InvalidDeckName", "Missing deck name."));
											return;
										}
										var deckSleeves = 0;
										if (d.TryGetValue("deckSleeves", out var deckSleevesString) && (!int.TryParse(deckSleevesString, out deckSleeves) || deckSleeves is < 0 or >= 25)) {
											SetErrorResponse(e.Response, new(HttpStatusCode.BadRequest, "InvalidDeckSleeves", "Invalid deck sleeves."));
											return;
										}
										if (!d.TryGetValue("deckCards", out var deckString)) {
											SetErrorResponse(e.Response, new(HttpStatusCode.BadRequest, "InvalidDeckCards", "Missing deck cards."));
											return;
										}

										Dictionary<int, UserCustomCard>? userCustomCards = null;
										List<KeyValuePair<int, Card>>? customCardsToAdd = null;
										if (d.TryGetValue("customCards", out var customCardsString)) {
											if (!game.AllowCustomCards) {
												SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "CustomCardsNotAllowed", "Custom cards cannot be used in this game."));
												return;
											}
											userCustomCards = JsonUtils.Deserialise<Dictionary<int, UserCustomCard>>(customCardsString);

											// Validate custom cards.
											if (userCustomCards is null || userCustomCards.Count > 15 || userCustomCards.Keys.Any(k => k is not (<= -10000 and >= short.MinValue))) {
												SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidCustomCards", "Invalid custom cards."));
												return;
											}

											customCardsToAdd = new(userCustomCards.Count);
											foreach (var (k, v) in userCustomCards) {
												if (!v.CheckGrid(out var hasSpecialSpace, out var size)) {
													SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidCustomCards", $"Custom card {k} is invalid."));
													return;
												}
												// Allow resending the same custom card, but not a different custom card with the same key.
												if (player.customCardMap.TryGetValue(k, out var existingCustomCardNumber)) {
													if (!v.Equals(game.customCards[RECEIVED_CUSTOM_CARD_START - existingCustomCardNumber])) {
														SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidCustomCards", $"Cannot reuse custom card number {k}."));
														return;
													}
												} else {
													// TODO: Consolidate identical custom cards brought by different players.
													var card = v.ToCard(RECEIVED_CUSTOM_CARD_START - (game.customCards.Count + customCardsToAdd.Count), k, !hasSpecialSpace && size >= 8 ? 3 : null);
													customCardsToAdd.Add(new(k, card));
												}
											}
										}

										var array = deckString.Split([',', '+', ' '], 15);
										if (array.Length != 15) {
											SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidDeckCards", "Invalid deck list."));
											return;
										}
										int[]? upgrades = null;
										if (d.TryGetValue("deckUpgrades", out var deckUpgradesString)) {
											upgrades = new int[15];
											var array2 = deckUpgradesString.Split([',', '+', ' '], 15);
											for (var i = 0; i < 15; i++) {
												if (int.TryParse(array2[i], out var j) && i is >= 0 and <= 2)
													upgrades[i] = j;
												else {
													SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidDeckUpgrades", "Invalid deck upgrade list."));
													return;
												}
											}
										}
										var cards = new int[15];
										for (var i = 0; i < 15; i++) {
											if (!int.TryParse(array[i], out var cardNumber) || (!CardDatabase.IsValidCardNumber(cardNumber) && (userCustomCards == null || !userCustomCards.ContainsKey(cardNumber)))) {
												SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidDeckCards", "Invalid deck list."));
												return;
											}
											if (Array.IndexOf(cards, cardNumber, 0, i) >= 0) {
												SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "InvalidDeckCards", "Deck cannot have duplicates."));
												return;
											}
											if (!game.AllowUpcomingCards && cardNumber is < 0 and > CUSTOM_CARD_START && CardDatabase.GetCard(cardNumber).Number < 0) {
												SetErrorResponse(e.Response, new(HttpStatusCode.UnprocessableEntity, "ForbiddenDeck", "Upcoming cards cannot be used in this game."));
												return;
											}
											// Translate custom card numbers from the player to game-scoped card numbers.
											cards[i] = player.customCardMap.TryGetValue(cardNumber, out var n) ? n : cardNumber <= CUSTOM_CARD_START && customCardsToAdd?.FirstOrDefault(e => e.Key == cardNumber).Value is Card customCard ? customCard.Number : cardNumber;
										}

										if (customCardsToAdd != null) {
											foreach (var (userKey, card) in customCardsToAdd) {
												player.customCardMap.Add(userKey, card.Number);
												game.customCards.Add(card);
											}
										}
										player.CurrentGameData.Deck = game.GetDeck(deckName, deckSleeves, cards, upgrades ?? Enumerable.Repeat(0, 15));
										e.Response.StatusCode = (int) HttpStatusCode.NoContent;
										game.SendPlayerReadyEvent(playerIndex, false);
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

										var isTimeout = d.TryGetValue("isTimeout", out var isTimeoutStr) && isTimeoutStr.ToLower() is not ("false" or "0");

										var card = player.Hand![handIndex];
										if (d.TryGetValue("isPass", out var isPassStr) && isPassStr.ToLower() is not ("false" or "0")) {
											player.Move = new(card, true, 0, 0, 0, false, isTimeout);
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
											player.Move = new(card, false, x, y, r, isSpecialAttack, isTimeout);
										}
										e.Response.StatusCode = (int) HttpStatusCode.NoContent;
										game.SendPlayerReadyEvent(playerIndex, isTimeout);
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
										player.Move = new(player.Hand![0], false, 0, 0, 0, redraw, false);
										e.Response.StatusCode = (int) HttpStatusCode.NoContent;
										game.SendPlayerReadyEvent(playerIndex, false);
										timer.Start();
									} catch (ArgumentException) {
										e.Response.StatusCode = (int) HttpStatusCode.BadRequest;
									}
								}
								break;
							}
							case "nextGame": {
								if (e.Request.HttpMethod != "POST") {
									e.Response.AddHeader("Allow", "POST");
									SetErrorResponse(e.Response, new(HttpStatusCode.MethodNotAllowed, "MethodNotAllowed", "Invalid request method for this endpoint."));
								} else if (e.Request.ContentLength64 >= 65536) {
									e.Response.StatusCode = (int) HttpStatusCode.RequestEntityTooLarge;
								} else {
									try {
										if (game.State is not (GameState.GameEnded or GameState.SetEnded)) {
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

										if (player.Move == null) {
											player.Move = new(player.Hand![0], false, 0, 0, 0, false, false);  // Dummy move to indicate that the player is ready.
											game.SendPlayerReadyEvent(playerIndex, false);
										}
										e.Response.StatusCode = (int) HttpStatusCode.NoContent;
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
									if (game.State != GameState.SetEnded) {
										SetErrorResponse(e.Response, new(HttpStatusCode.Conflict, "GameInProgress", "You can't see the replay until the set has ended."));
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
		var bytes = Encoding.UTF8.GetBytes(JsonUtils.Serialise(error));
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
			? s.Split(['&']).Select(s => s.Split('=')).Select(a => a.Length == 2 ? a : throw new ArgumentException("Invalid form data"))
				.ToDictionary(a => HttpUtility.UrlDecode(a[0]), a => HttpUtility.UrlDecode(a[1]))
			: [];
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

	private static bool TryParseStageSelectionRule(string json, [MaybeNullWhen(false)] out StageSelectionRules stageSelectionRule) {
		try {
			stageSelectionRule = JsonUtils.Deserialise<StageSelectionRules>(json);
			return stageSelectionRule != null;
		} catch (JsonSerializationException) {
			stageSelectionRule = null;
			return false;
		}
	}

	[GeneratedRegex(@"^/api/games/([\w-]+)(?:/(\w+)(?:\?clientToken=([\w-]+))?)?$", RegexOptions.Compiled)]
	private static partial Regex GamePathRegex();
}
