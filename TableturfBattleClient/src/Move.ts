interface Move {
	card: Card;
	isPass: boolean;
}

interface PlayMove extends Move {
	isPass: false;
	x: number;
	y: number;
	rotation: number;
	isSpecialAttack: boolean;
}
