interface Move {
	card: Card;
	isPass: boolean;
}

interface PlayMove extends Move {
	isPass: true;
	x: number;
	y: number;
	rotation: number;
	isSpecialAttack: boolean;
}
