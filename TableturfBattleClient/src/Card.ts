class Card {
	number: number;
	name: string;
	rarity: Rarity;
	specialCost: number;
	grid: Space[][];
	size: number;

	constructor(number: number, name: string, rarity: Rarity, specialCost: number, grid: Space[][]) {
		this.number = number;
		this.name = name;
		this.rarity = rarity;
		this.specialCost = specialCost;
		this.grid = grid;

		let size = 0;
		for (let y = 0; y < 8; y++) {
			for (let x = 0; x < 8; x++) {
				if (grid[x][y] != Space.Empty)
					size++;
			}
		}
		this.size = size;
	}

	static fromJson(obj: any) {
		return new Card(obj.number, obj.name, obj.rarity, obj.specialCost, obj.grid);
	}

	getSpace(x: number, y: number, rotation: number) {
		switch (rotation & 3) {
			case 0: return this.grid[x][y];
			case 1: return this.grid[y][7 - x];
			case 2: return this.grid[7 - x][7 - y];
			default: return this.grid[7 - y][x];
		}
	}
}
