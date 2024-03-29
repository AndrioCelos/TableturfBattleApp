﻿using System.Web;
using WebSocketSharp.Server;

namespace TableturfBattleServer;

internal class TableturfWebSocketBehaviour : WebSocketBehavior {
	public Guid GameID { get; private set; }
	public Guid ClientToken { get; private set; }
	public Game? Game { get; private set; }
	public Player? Player { get; private set; }

	protected override void OnOpen() {
		var args = this.Context.RequestUri.Query[1..].Split('&').Select(s => s.Split('=', 2)).Where(a => a.Length == 2)
			.ToDictionary(a => HttpUtility.UrlDecode(a[0]), a => HttpUtility.UrlDecode(a[1]));
		if (args.TryGetValue("gameID", out var gameIDString) && Guid.TryParse(gameIDString, out var gameID))
			this.GameID = gameID;
		if (args.TryGetValue("clientToken", out var clientTokenString) && Guid.TryParse(clientTokenString, out var clientToken))
			this.ClientToken = clientToken;

		// Send an initial state payload.
		if (Server.Instance.TryGetGame(this.GameID, out var game)) {
			DTO.PlayerData? playerData = null;
			for (int i = 0; i < game.Players.Count; i++) {
				var player = game.Players[i];
				if (player.Token == this.ClientToken) {
					this.Player = player;
					playerData = new(i, player);
					game.AddConnection(i, this);
					break;
				}
			}
			this.Game = game;
			this.Send(JsonUtils.Serialise(new DTO.WebSocketPayloadWithPlayerData<Game?>("sync", game, playerData, this.ClientToken == game.HostClientToken)));
		} else
			this.Send(JsonUtils.Serialise(new DTO.WebSocketPayloadWithPlayerData<Game?>("sync", null, null, false)));
	}

	protected override void OnClose(WebSocketSharp.CloseEventArgs e) {
		if (this.Player != null) this.Game?.RemoveConnection(this.Player, this);
	}

	internal void SendInternal(string data) => this.Send(data);
}
