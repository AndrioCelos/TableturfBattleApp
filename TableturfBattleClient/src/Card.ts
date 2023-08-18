class Card {
	number: number;
	altNumber: number | null;
	name: string;
	rarity: Rarity;
	specialCost: number;
	grid: readonly (readonly Space[])[];
	size: number;

	private minX: number;
	private minY: number;
	private maxX: number;
	private maxY: number;

	constructor(number: number, altNumber: number | null, name: string, rarity: Rarity, specialCost: number, grid: Space[][]) {
		this.number = number;
		this.altNumber = altNumber;
		this.name = name;
		this.rarity = rarity;
		this.specialCost = specialCost;
		this.grid = grid;

		let size = 0, minX = 3, minY = 3, maxX = 3, maxY = 3;
		for (let y = 0; y < 8; y++) {
			for (let x = 0; x < 8; x++) {
				if (grid[x][y] != Space.Empty) {
					size++;
					minX = Math.min(minX, x);
					minY = Math.min(minY, y);
					maxX = Math.max(maxX, x);
					maxY = Math.max(maxY, y);
				}
			}
		}
		this.size = size;
		this.minX = minX;
		this.minY = minY;
		this.maxX = maxX;
		this.maxY = maxY;
	}

	static fromJson(obj: any) {
		return new Card(obj.number, obj.altNumber ?? null, obj.name, obj.rarity, obj.specialCost, obj.grid);
	}

	get isUpcoming() { return this.number < 0; }

	getSpace(x: number, y: number, rotation: number) {
		switch (rotation & 3) {
			case 0: return this.grid[x][y];
			case 1: return this.grid[y][7 - x];
			case 2: return this.grid[7 - x][7 - y];
			default: return this.grid[7 - y][x];
		}
	}

	clampPosition(x: number, y: number, boardWidth: number, boardHeight: number, rotation: number) {
		let x1, y1, x2, y2;
		switch (rotation & 3) {
			case 0: x1 = this.minX; y1 = this.minY; x2 = this.maxX; y2 = this.maxY; break;
			case 1: x1 = 7 - this.maxY; y1 = this.minX; x2 = 7 - this.minY; y2 = this.maxX; break;
			case 2: x1 = 7 - this.maxX; y1 = 7 - this.maxY; x2 = 7 - this.minX; y2 = 7 - this.minY; break;
			default: x1 = this.minY; y1 = 7 - this.maxX; x2 = this.maxY; y2 = 7 - this.minX; break;
		}
		x = Math.min(Math.max(x, -x1), boardWidth - 1 - x2);
		y = Math.min(Math.max(y, -y1), boardHeight - 1 - y2);
		return { x, y };
	}
}
