interface PlayerData {
	playerIndex: number;
	hand: Card[] | null;
	deck: Card[] | null;
	cardsUsed: number[];
	move: Move | null;
}
