using Newtonsoft.Json;

namespace TableturfBattleServer.DTO;

internal class WebSocketPayload<T> {
	[JsonProperty("event")]
	public string EventName;
	[JsonProperty("data")]
	public T Payload;

	public WebSocketPayload(string eventName, T payload) {
		this.EventName = eventName ?? throw new ArgumentNullException(nameof(eventName));
		this.Payload = payload;
	}
}
internal class WebSocketPayloadWithPlayerData<T> : WebSocketPayload<T> {
	[JsonProperty("playerData")]
	public PlayerData? PlayerData;

	public WebSocketPayloadWithPlayerData(string eventName, T payload, PlayerData? playerData) : base(eventName, payload)
		=> this.PlayerData = playerData;
}

public class PlayerData {
	[JsonProperty("playerIndex")]
	public int PlayerIndex;
	[JsonProperty("hand")]
	public Card[]? Hand;
	[JsonProperty("deck")]
	public Card[]? Deck;
	[JsonProperty("move")]
	public Move? Move;
	[JsonProperty("cardsUsed")]
	public List<int>? CardsUsed;

	public PlayerData(int playerIndex, Card[]? hand, Card[]? deck, Move? move, List<int>? cardsUsed) {
		this.PlayerIndex = playerIndex;
		this.Hand = hand;
		this.Deck = deck;
		this.Move = move;
		this.CardsUsed = cardsUsed;
	}
	public PlayerData(int playerIndex, Player player) : this(playerIndex, player.Hand, player.Deck, player.Move, player.CardsUsed) { }
}
