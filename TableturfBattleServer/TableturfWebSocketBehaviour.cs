using System.Web;

using WebSocketSharp.Server;

internal class TableturfWebSocketBehaviour : WebSocketBehavior {
	public Guid GameID { get; set; }
	public Guid ClientToken { get; set; }

	protected override void OnOpen() {
		var args = this.Context.RequestUri.Query[1..].Split('&').Select(s => s.Split('=', 2)).Where(a => a.Length == 2)
			.ToDictionary(a => HttpUtility.UrlDecode(a[0]), a => HttpUtility.UrlDecode(a[1]));
		if (args.TryGetValue("gameID", out var gameIDString) && Guid.TryParse(gameIDString, out var gameID))
			this.GameID = gameID;
		if (args.TryGetValue("clientToken", out var clientTokenString) && Guid.TryParse(clientTokenString, out var clientToken))
			this.ClientToken = clientToken;
	}

	internal void SendInternal(string data) => this.Send(data);
}