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

public record UserCustomCard(string Name, string? Line1, string? Line2, int? SpecialCost, Colour InkColour1, Colour InkColour2, Rarity Rarity, Space[,] Grid) {
	public bool CheckGrid(out bool hasSpecialSpace, out int size) {
		size = 0;
		hasSpecialSpace = false;
		if (this.Grid is null || this.Grid.GetLength(0) != 8 || this.Grid.GetLength(1) != 8) return false;
		for (var x = 0; x < 8; x++) {
			for (var y = 0; y < 8; y++) {
				switch (this.Grid[x, y]) {
					case Space.Empty:
						break;
					case Space.Ink1:
						size++;
						break;
					case Space.SpecialInactive1:
						if (hasSpecialSpace) return false;
						size++;
						hasSpecialSpace = true;
						break;
					default:
						return false;
				}
			}
		}
		// TODO: Maybe also check that the ink pattern is fully connected.
		return size > 0;
	}

	public bool Equals(Card? card) {
		if (card is null || card.Name != this.Name || card.Rarity != this.Rarity || card.SpecialCost != this.SpecialCost) return false;
		for (var x = 0; x < 8; x++) {
			for (var y = 0; y < 8; y++) {
				if (this.Grid[x, y] != card.GetSpace(x, y, 0)) return false;
			}
		}
		return true;
	}

	public Card ToCard(int number, int altNumber, int? defaultSpecialCost) => new(number, altNumber, this.Line2 != null ? $"{this.Line1}\n{this.Line2}" : this.Name, this.Rarity, this.SpecialCost ?? defaultSpecialCost, null, this.Grid) { InkColour1 = this.InkColour1, InkColour2 = this.InkColour2 };
}
