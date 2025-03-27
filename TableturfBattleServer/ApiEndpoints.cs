#pragma warning disable IDE0060 // Remove unused parameter

using System.Net;
using TableturfBattleServer.DTO;
using HttpListenerRequest = WebSocketSharp.Net.HttpListenerRequest;
using HttpListenerResponse = WebSocketSharp.Net.HttpListenerResponse;

namespace TableturfBattleServer;
internal static class ApiEndpoints {
	internal static readonly char[] DELIMITERS = [',', ' '];
	internal const int CUSTOM_CARD_START = -10000;
	internal const int RECEIVED_CUSTOM_CARD_START = -20000;

	[ApiEndpoint("/games/new", "POST")]
	public static void ApiGamesNew(HttpListenerRequest request, HttpListenerResponse response) {
		if (request.HttpMethod != "POST") {
			response.AddHeader("Allow", "POST");
			response.SetErrorResponse(new(HttpStatusCode.MethodNotAllowed, "MethodNotAllowed", "Invalid request method for this endpoint."));
		} else if (Server.Instance.Lockdown) {
			response.SetErrorResponse(new(HttpStatusCode.ServiceUnavailable, "ServerLocked", "The server is temporarily locked for an update. Please try again soon."));
		} else if (request.ContentLength64 >= 65536) {
			response.StatusCode = (int) HttpStatusCode.RequestEntityTooLarge;
		} else {
			try {
				var d = HttpRequestHelper.DecodeFormData(request.InputStream);
				Guid clientToken;
				if (!d.TryGetValue("name", out var name)) {
					response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidName", "Missing name."));
					return;
				}
				if (name.Length > 32) {
					response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidName", "Name is too long."));
					return;
				}
				var maxPlayers = 2;
				if (d.TryGetValue("maxPlayers", out var maxPlayersString)) {
					if (!int.TryParse(maxPlayersString, out maxPlayers) || maxPlayers < 2 || maxPlayers > 4) {
						response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidMaxPlayers", "Invalid player limit."));
						return;
					}
				}
				int? turnTimeLimit = null;
				if (d.TryGetValue("turnTimeLimit", out var turnTimeLimitString) && turnTimeLimitString != "") {
					if (!int.TryParse(turnTimeLimitString, out var turnTimeLimit2) || turnTimeLimit2 < 10) {
						response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidTurnTimeLimit", "Invalid turn time limit."));
						return;
					}
					turnTimeLimit = turnTimeLimit2;
				}
				int? goalWinCount = null;
				if (d.TryGetValue("goalWinCount", out var goalWinCountString) && goalWinCountString != "") {
					if (!int.TryParse(goalWinCountString, out var goalWinCount2) || goalWinCount2 < 1) {
						response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidGoalWinCount", "Invalid goal win count."));
						return;
					}
					goalWinCount = goalWinCount2;
				}
				if (d.TryGetValue("clientToken", out var tokenString) && tokenString != "") {
					if (!Guid.TryParse(tokenString, out clientToken)) {
						response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidClientToken", "Invalid client token."));
						return;
					}
				} else
					clientToken = Guid.NewGuid();

				bool allowUpcomingCards;
				if (d.TryGetValue("allowUpcomingCards", out var allowUpcomingCardsString)) {
					if (!bool.TryParse(allowUpcomingCardsString, out allowUpcomingCards))
						response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidGameSettings", "allowUpcomingCards was invalid."));
				} else
					allowUpcomingCards = true;

				bool allowCustomCards;
				if (d.TryGetValue("allowCustomCards", out var allowCustomCardsString)) {
					if (!bool.TryParse(allowCustomCardsString, out allowCustomCards))
						response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidGameSettings", "allowCustomCards was invalid."));
				} else
					allowCustomCards = false;

				StageSelectionRules? stageSelectionRuleFirst = null, stageSelectionRuleAfterWin = null, stageSelectionRuleAfterDraw = null;
				if (d.TryGetValue("stageSelectionRuleFirst", out var json1)) {
					if (!HttpRequestHelper.TryParseStageSelectionRule(json1, maxPlayers, out stageSelectionRuleFirst) || stageSelectionRuleFirst.Method is StageSelectionMethod.Same or StageSelectionMethod.Counterpick) {
						response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidGameSettings", "stageSelectionRuleFirst was invalid."));
						return;
					}
				} else
					stageSelectionRuleFirst = StageSelectionRules.Default;
				if (d.TryGetValue("stageSelectionRuleAfterWin", out var json2)) {
					if (!HttpRequestHelper.TryParseStageSelectionRule(json2, maxPlayers, out stageSelectionRuleAfterWin)) {
						response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidGameSettings", "stageSelectionRuleAfterWin was invalid."));
						return;
					}
				} else
					stageSelectionRuleAfterWin = stageSelectionRuleFirst;
				if (d.TryGetValue("stageSelectionRuleAfterDraw", out var json3)) {
					if (!HttpRequestHelper.TryParseStageSelectionRule(json3, maxPlayers, out stageSelectionRuleAfterDraw) || stageSelectionRuleAfterDraw.Method == StageSelectionMethod.Counterpick) {
						response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidGameSettings", "stageSelectionRuleAfterDraw was invalid."));
						return;
					}
				} else
					stageSelectionRuleAfterDraw = stageSelectionRuleFirst;

				var forceSameDeckAfterDraw = false;
				if (d.TryGetValue("forceSameDeckAfterDraw", out var forceSameDeckAfterDrawString)) {
					if (!bool.TryParse(forceSameDeckAfterDrawString, out forceSameDeckAfterDraw))
						response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidGameSettings", "forceSameDeckAfterDraw was invalid."));
				} else
					forceSameDeckAfterDraw = false;

				var spectate = false;
				if (d.TryGetValue("spectate", out var spectateString)) {
					if (!bool.TryParse(spectateString, out spectate))
						response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidGameSettings", "spectate was invalid."));
				} else
					spectate = false;

				var game = new Game(maxPlayers) { HostClientToken = clientToken, GoalWinCount = goalWinCount, TurnTimeLimit = turnTimeLimit, AllowUpcomingCards = allowUpcomingCards, AllowCustomCards = allowCustomCards, StageSelectionRuleFirst = stageSelectionRuleFirst, StageSelectionRuleAfterWin = stageSelectionRuleAfterWin, StageSelectionRuleAfterDraw = stageSelectionRuleAfterDraw, ForceSameDeckAfterDraw = forceSameDeckAfterDraw };
				if (!spectate)
					game.TryAddPlayer(new(game, name, clientToken), out _, out _);
				Server.Instance.games.Add(game.ID, game);
				Server.Instance.timer.Start();

				response.SetResponse(HttpStatusCode.OK, "application/json", JsonUtils.Serialise(new { gameID = game.ID, clientToken, maxPlayers }));
				Console.WriteLine($"New game started: {game.ID}; {Server.Instance.games.Count} games active; {Server.Instance.inactiveGames.Count} inactive");
			} catch (ArgumentException) {
				response.SetErrorResponse(new(HttpStatusCode.BadRequest, "InvalidRequestData", "Invalid form data"));
			}
		}
	}

	[ApiEndpoint("/cards", "GET")]
	public static void ApiCards(HttpListenerRequest request, HttpListenerResponse response)
		=> HttpRequestHelper.SetStaticResponse(request, response, CardDatabase.JSON, CardDatabase.Version.ToString(), CardDatabase.LastModified);

	[ApiEndpoint("/stages", "GET")]
	public static void ApiStages(HttpListenerRequest request, HttpListenerResponse response)
		=> HttpRequestHelper.SetStaticResponse(request, response, StageDatabase.JSON, StageDatabase.Version.ToString(), StageDatabase.LastModified);

	[ApiEndpoint(ApiEndpointNamespace.Game, "/", "GET")]
	public static void ApiGameRoot(Game game, HttpListenerRequest request, HttpListenerResponse response)
		=> response.SetResponse(HttpStatusCode.OK, "application/json", JsonUtils.Serialise(game));

	[ApiEndpoint(ApiEndpointNamespace.Game, "/playerData", "GET")]
	public static void ApiGamePlayerData(Game game, HttpListenerRequest request, HttpListenerResponse response) {
		if (request.QueryString["clientToken"] is not string s || !Guid.TryParse(s, out var clientToken))
			clientToken = Guid.Empty;

		response.SetResponse(HttpStatusCode.OK, "application/json", JsonUtils.Serialise(new {
			game,
			playerData = game.GetPlayer(clientToken, out var playerIndex, out var player)
				? new PlayerData(playerIndex, player)
				: null
		}));
	}

	[ApiEndpoint(ApiEndpointNamespace.Game, "/join", "POST")]
	public static void ApiGameJoin(Game game, HttpListenerRequest request, HttpListenerResponse response) {
		try {
			var d = HttpRequestHelper.DecodeFormData(request.InputStream);
			Guid clientToken;
			if (!d.TryGetValue("name", out var name)) {
				response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidName", "Missing name."));
				return;
			}
			if (name.Length > 32) {
				response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidName", "Name is too long."));
				return;
			}
			if (d.TryGetValue("clientToken", out var tokenString) && tokenString != "") {
				if (!Guid.TryParse(tokenString, out clientToken)) {
					response.SetErrorResponse(new(HttpStatusCode.BadRequest, "InvalidClientToken", "Invalid client token."));
					return;
				}
			} else
				clientToken = Guid.NewGuid();

			if (!game.GetPlayer(clientToken, out var playerIndex, out var player)) {
				if (game.State != GameState.WaitingForPlayers) {
					response.SetErrorResponse(new(HttpStatusCode.Gone, "GameAlreadyStarted", "The game has already started."));
					return;
				}

				player = new Player(game, name, clientToken);
				if (!game.TryAddPlayer(player, out playerIndex, out var error)) {
					response.SetErrorResponse(error);
					return;
				}

				game.SendEvent("join", new { playerIndex, player }, false);
			}
			// If they're already in the game, resend the original join response instead of an error.
			response.SetResponse(HttpStatusCode.OK, "application/json", JsonUtils.Serialise(new { playerIndex, clientToken }));
			Server.Instance.timer.Start();
		} catch (ArgumentException) {
			response.SetErrorResponse(new(HttpStatusCode.BadRequest, "InvalidRequestData", "Invalid form data"));
		}
	}

	[ApiEndpoint(ApiEndpointNamespace.Game, "/setGameSettings", "POST")]
	public static void ApiGameSetGameSettings(Game game, HttpListenerRequest request, HttpListenerResponse response) {
		var d = HttpRequestHelper.DecodeFormData(request.InputStream);
		if (!d.TryGetValue("clientToken", out var tokenString) || !Guid.TryParse(tokenString, out var clientToken)) {
			response.SetErrorResponse(new(HttpStatusCode.BadRequest, "InvalidClientToken", "Invalid client token."));
			return;
		}
		if (clientToken != game.HostClientToken) {
			response.SetErrorResponse(new(HttpStatusCode.Forbidden, "AccessDenied", "Only the host can do that."));
			return;
		}
		if (game.State != GameState.WaitingForPlayers) {
			response.SetErrorResponse(new(HttpStatusCode.Gone, "GameAlreadyStarted", "The game has already started."));
			return;
		}

		if (d.TryGetValue("turnTimeLimit", out var turnTimeLimitString)) {
			if (turnTimeLimitString == "")
				game.TurnTimeLimit = null;
			else if (!int.TryParse(turnTimeLimitString, out var turnTimeLimit2) || turnTimeLimit2 < 10) {
				response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidGameSettings", "Invalid turn time limit."));
				return;
			} else
				game.TurnTimeLimit = turnTimeLimit2;
		}

		if (d.TryGetValue("allowUpcomingCards", out var allowUpcomingCardsString)) {
			if (!bool.TryParse(allowUpcomingCardsString, out var allowUpcomingCards)) {
				response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidGameSettings", "Invalid allowUpcomingCards."));
				return;
			} else
				game.AllowUpcomingCards = allowUpcomingCards;
		}

		if (d.TryGetValue("allowCustomCards", out var allowCustomCardsString)) {
			if (!bool.TryParse(allowCustomCardsString, out var allowCustomCards)) {
				response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidGameSettings", "Invalid allowCustomCards."));
				return;
			} else
				game.AllowCustomCards = allowCustomCards;
		}

		game.SendEvent("settingsChange", game, false);
	}

	[ApiEndpoint(ApiEndpointNamespace.Game, "/chooseStage", "POST")]
	public static void ApiGameChooseStage(Game game, HttpListenerRequest request, HttpListenerResponse response) {
		var d = HttpRequestHelper.DecodeFormData(request.InputStream);
		if (!d.TryGetValue("clientToken", out var tokenString) || !Guid.TryParse(tokenString, out var clientToken)) {
			response.SetErrorResponse(new(HttpStatusCode.BadRequest, "InvalidClientToken", "Invalid client token."));
			return;
		}
		if (!game.GetPlayer(clientToken, out var playerIndex, out var player)) {
			response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "NotInGame", "You're not in the game."));
			return;
		}
		if (!d.TryGetValue("stages", out var stagesString)) {
			response.SetErrorResponse(new(HttpStatusCode.BadRequest, "InvalidStage", "Missing stages."));
			return;
		}

		var stages = new HashSet<int>();
		foreach (var field in stagesString.Split(DELIMITERS, StringSplitOptions.RemoveEmptyEntries)) {
			if (!int.TryParse(field, out var i)) {
				response.SetErrorResponse(new(HttpStatusCode.BadRequest, "InvalidStage", "Invalid stages."));
				return;
			}
			stages.Add(i);
		}

		if (!game.TryChooseStages(player, stages, out var error)) {
			response.SetErrorResponse(error);
			return;
		}

		response.StatusCode = (int) HttpStatusCode.NoContent;
		game.SendPlayerReadyEvent(playerIndex, false);
		Server.Instance.timer.Start();
	}

	[ApiEndpoint(ApiEndpointNamespace.Game, "/chooseDeck", "POST")]
	public static void ApiGameChooseDeck(Game game, HttpListenerRequest request, HttpListenerResponse response) {
		try {
			var d = HttpRequestHelper.DecodeFormData(request.InputStream);
			if (!d.TryGetValue("clientToken", out var tokenString) || !Guid.TryParse(tokenString, out var clientToken)) {
				response.SetErrorResponse(new(HttpStatusCode.BadRequest, "InvalidClientToken", "Invalid client token."));
				return;
			}
			if (!game.GetPlayer(clientToken, out var playerIndex, out var player)) {
				response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "NotInGame", "You're not in the game."));
				return;
			}
			if (player.CurrentGameData.Deck != null) {
				response.SetErrorResponse(new(HttpStatusCode.Conflict, "DeckAlreadyChosen", "You've already chosen a deck."));
				return;
			}

			if (!d.TryGetValue("deckName", out var deckName)) {
				response.SetErrorResponse(new(HttpStatusCode.BadRequest, "InvalidDeckName", "Missing deck name."));
				return;
			}
			var deckSleeves = 0;
			if (d.TryGetValue("deckSleeves", out var deckSleevesString) && !int.TryParse(deckSleevesString, out deckSleeves)) {
				response.SetErrorResponse(new(HttpStatusCode.BadRequest, "InvalidDeckSleeves", "Invalid deck sleeves."));
				return;
			}
			if (!d.TryGetValue("deckCards", out var deckString)) {
				response.SetErrorResponse(new(HttpStatusCode.BadRequest, "InvalidDeckCards", "Missing deck cards."));
				return;
			}

			Dictionary<int, UserCustomCard>? userCustomCards = null;
			List<KeyValuePair<int, Card>>? customCardsToAdd = null;
			if (d.TryGetValue("customCards", out var customCardsString)) {
				if (!game.AllowCustomCards) {
					response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "CustomCardsNotAllowed", "Custom cards cannot be used in this game."));
					return;
				}
				userCustomCards = JsonUtils.Deserialise<Dictionary<int, UserCustomCard>>(customCardsString);

				// Validate custom cards.
				if (userCustomCards is null || userCustomCards.Count > 15 || userCustomCards.Keys.Any(k => k is not (<= -10000 and >= short.MinValue))) {
					response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidCustomCards", "Invalid custom cards."));
					return;
				}

				customCardsToAdd = new(userCustomCards.Count);
				foreach (var (k, v) in userCustomCards) {
					if (!v.CheckGrid(out var hasSpecialSpace, out var size)) {
						response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidCustomCards", $"Custom card {k} is invalid."));
						return;
					}
					// Allow resending the same custom card, but not a different custom card with the same key.
					if (player.customCardMap.TryGetValue(k, out var existingCustomCardNumber)) {
						if (!v.Equals(game.customCards[RECEIVED_CUSTOM_CARD_START - existingCustomCardNumber])) {
							response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidCustomCards", $"Cannot reuse custom card number {k}."));
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
				response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidDeckCards", "Invalid deck list."));
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
						response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidDeckUpgrades", "Invalid deck upgrade list."));
						return;
					}
				}
			}
			var cards = new int[15];
			for (var i = 0; i < 15; i++) {
				if (!int.TryParse(array[i], out var cardNumber) || (!CardDatabase.IsValidCardNumber(cardNumber) && (userCustomCards == null || !userCustomCards.ContainsKey(cardNumber)))) {
					response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidDeckCards", "Invalid deck list."));
					return;
				}
				if (Array.IndexOf(cards, cardNumber, 0, i) >= 0) {
					response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "InvalidDeckCards", "Deck cannot have duplicates."));
					return;
				}
				if (!game.AllowUpcomingCards && cardNumber is < 0 and > CUSTOM_CARD_START && CardDatabase.GetCard(cardNumber).Number < 0) {
					response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "ForbiddenDeck", "Upcoming cards cannot be used in this game."));
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
			response.StatusCode = (int) HttpStatusCode.NoContent;
			game.SendPlayerReadyEvent(playerIndex, false);
			Server.Instance.timer.Start();
		} catch (ArgumentException) {
			response.SetErrorResponse(new(HttpStatusCode.BadRequest, "InvalidRequestData", "Invalid form data"));
		}
	}

	[ApiEndpoint(ApiEndpointNamespace.Game, "/play", "POST")]
	public static void ApiGamePlay(Game game, HttpListenerRequest request, HttpListenerResponse response) {
		try {
			var d = HttpRequestHelper.DecodeFormData(request.InputStream);
			if (!d.TryGetValue("clientToken", out var tokenString) || !Guid.TryParse(tokenString, out var clientToken)) {
				response.SetErrorResponse(new(HttpStatusCode.BadRequest, "InvalidClientToken", "Invalid client token."));
				return;
			}
			if (game.State != GameState.Ongoing) {
				response.SetErrorResponse(new(HttpStatusCode.Conflict, "GameNotSetUp", "You can't do that in this game state."));
				return;
			}
			if (!game.GetPlayer(clientToken, out var playerIndex, out var player)) {
				response.SetErrorResponse(new(HttpStatusCode.Forbidden, "NotInGame", "You're not in the game."));
				return;
			}

			if (player.Move != null) {
				response.SetErrorResponse(new(HttpStatusCode.Conflict, "MoveAlreadyChosen", "You've already chosen a move."));
				return;
			}

			if (!d.TryGetValue("cardNumber", out var cardNumberStr) || !int.TryParse(cardNumberStr, out var cardNumber)) {
				response.SetErrorResponse(new(HttpStatusCode.BadRequest, "InvalidCard", "Missing or invalid card number."));
				return;
			}

			var handIndex = player.GetHandIndex(cardNumber);
			if (handIndex < 0) {
				response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "MissingCard", "You don't have that card."));
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
					response.SetErrorResponse(new(HttpStatusCode.BadRequest, "InvalidPosition", "Missing or invalid position."));
					return;
				}
				r &= 3;
				if (!game.CanPlay(playerIndex, card, x, y, r, isSpecialAttack)) {
					response.SetErrorResponse(new(HttpStatusCode.UnprocessableEntity, "IllegalMove", "Illegal move"));
					return;
				}
				player.Move = new(card, false, x, y, r, isSpecialAttack, isTimeout);
			}
			response.StatusCode = (int) HttpStatusCode.NoContent;
			game.SendPlayerReadyEvent(playerIndex, isTimeout);
			Server.Instance.timer.Start();
		} catch (ArgumentException) {
			response.StatusCode = (int) HttpStatusCode.BadRequest;
		}
	}

	[ApiEndpoint(ApiEndpointNamespace.Game, "/redraw", "POST")]
	public static void ApiGameRedraw(Game game, HttpListenerRequest request, HttpListenerResponse response) {
		try {
			if (game.State != GameState.Redraw) {
				response.SetErrorResponse(new(HttpStatusCode.Conflict, "GameNotSetUp", "You can't do that in this game state."));
				return;
			}

			var d = HttpRequestHelper.DecodeFormData(request.InputStream);
			if (!d.TryGetValue("clientToken", out var tokenString) || !Guid.TryParse(tokenString, out var clientToken)) {
				response.SetErrorResponse(new(HttpStatusCode.BadRequest, "InvalidClientToken", "Invalid client token."));
				return;
			}
			if (!game.GetPlayer(clientToken, out var playerIndex, out var player)) {
				response.SetErrorResponse(new(HttpStatusCode.Forbidden, "NotInGame", "You're not in the game."));
				return;
			}

			if (player.Move != null) {
				response.SetErrorResponse(new(HttpStatusCode.Conflict, "MoveAlreadyChosen", "You've already chosen a move."));
				return;
			}

			var redraw = d.TryGetValue("redraw", out var redrawStr) && redrawStr.ToLower() is not ("false" or "0");
			player.Move = new(player.Hand![0], false, 0, 0, 0, redraw, false);
			response.StatusCode = (int) HttpStatusCode.NoContent;
			game.SendPlayerReadyEvent(playerIndex, false);
			Server.Instance.timer.Start();
		} catch (ArgumentException) {
			response.StatusCode = (int) HttpStatusCode.BadRequest;
		}
	}

	[ApiEndpoint(ApiEndpointNamespace.Game, "/nextGame", "POST")]
	public static void ApiGameNextGame(Game game, HttpListenerRequest request, HttpListenerResponse response) {
		try {
			if (game.State is not (GameState.GameEnded or GameState.SetEnded)) {
				response.SetErrorResponse(new(HttpStatusCode.Conflict, "GameNotSetUp", "You can't do that in this game state."));
				return;
			}

			var d = HttpRequestHelper.DecodeFormData(request.InputStream);
			if (!d.TryGetValue("clientToken", out var tokenString) || !Guid.TryParse(tokenString, out var clientToken)) {
				response.SetErrorResponse(new(HttpStatusCode.BadRequest, "InvalidClientToken", "Invalid client token."));
				return;
			}
			if (!game.GetPlayer(clientToken, out var playerIndex, out var player)) {
				response.SetErrorResponse(new(HttpStatusCode.Forbidden, "NotInGame", "You're not in the game."));
				return;
			}

			if (player.Move == null) {
				player.Move = new(player.Hand![0], false, 0, 0, 0, false, false);  // Dummy move to indicate that the player is ready.
				game.SendPlayerReadyEvent(playerIndex, false);
			}
			response.StatusCode = (int) HttpStatusCode.NoContent;
			Server.Instance.timer.Start();
		} catch (ArgumentException) {
			response.StatusCode = (int) HttpStatusCode.BadRequest;
		}
	}

	[ApiEndpoint(ApiEndpointNamespace.Game, "/replay", "GET")]
	public static void ApiGameReplay(Game game, HttpListenerRequest request, HttpListenerResponse response) {
		if (game.State != GameState.SetEnded) {
			response.SetErrorResponse(new(HttpStatusCode.Conflict, "GameInProgress", "You can't see the replay until the set has ended."));
			return;
		}
		var ms = new MemoryStream();
		game.WriteReplayData(ms);
		response.SetResponse(HttpStatusCode.OK, "application/octet-stream", ms.ToArray());
	}
}
