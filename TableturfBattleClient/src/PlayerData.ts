interface PlayerData {
	playerIndex: number;
	hand: Card[] | null;
	deck: Deck | null;
	cardsUsed: number[];
	move: Move | null;
}
