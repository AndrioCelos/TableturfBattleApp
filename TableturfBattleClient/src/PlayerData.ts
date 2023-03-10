interface PlayerData {
	playerIndex: number;
	hand: Card[] | null;
	deck: Card[] | null;
	cardsUsed: number[];
	move: Move | null;
}

interface ReplayPlayerData {
	deck: Card[],
	initialDrawOrder: number[],
	drawOrder: number[]
}
