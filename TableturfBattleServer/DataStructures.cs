using Newtonsoft.Json;

namespace TableturfBattleServer.DTO;

internal class WebSocketPayload<T>(string eventName, T payload) {
	[JsonProperty("event")]
	public string EventName = eventName ?? throw new ArgumentNullException(nameof(eventName));
	[JsonProperty("data")]
	public T Payload = payload;
}
internal class WebSocketPayloadWithPlayerData<T>(string eventName, T payload, PlayerData? playerData, bool isHost) : WebSocketPayload<T>(eventName, payload) {
	public PlayerData? PlayerData = playerData;
	public bool IsHost = isHost;
}

public class PlayerData(int playerIndex, Card[]? hand, Deck? deck, Move? move, List<int>? cardsUsed, StageSelectionPrompt? stageSelectionPrompt) {
	public int PlayerIndex = playerIndex;
	public Card[]? Hand = hand;
	public Deck? Deck = deck;
	public Move? Move = move;
	public List<int>? CardsUsed = cardsUsed;
	public StageSelectionPrompt? StageSelectionPrompt = stageSelectionPrompt;

	public PlayerData(int playerIndex, Player player) : this(playerIndex, player.Hand, player.CurrentGameData.Deck, player.Move, player.CardsUsed, player.StageSelectionPrompt) { }
}
