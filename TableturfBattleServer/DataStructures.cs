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
	public PlayerData? PlayerData;

	public WebSocketPayloadWithPlayerData(string eventName, T payload, PlayerData? playerData) : base(eventName, payload)
		=> this.PlayerData = playerData;
}

public class PlayerData {
	public int PlayerIndex;
	public Card[]? Hand;
	public Deck? Deck;
	public Move? Move;
	public List<int>? CardsUsed;

	public PlayerData(int playerIndex, Card[]? hand, Deck? deck, Move? move, List<int>? cardsUsed) {
		this.PlayerIndex = playerIndex;
		this.Hand = hand;
		this.Deck = deck;
		this.Move = move;
		this.CardsUsed = cardsUsed;
	}
	public PlayerData(int playerIndex, Player player) : this(playerIndex, player.Hand, player.CurrentGameData.Deck, player.Move, player.CardsUsed) { }
}
