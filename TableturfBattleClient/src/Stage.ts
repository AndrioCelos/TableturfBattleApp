class Stage {
	name: string;
	grid: Space[][];
	startSpaces: Point[][];

	constructor(name: string, grid: Space[][], startSpaces: Point[][]) {
		this.name = name;
		this.grid = grid;
		this.startSpaces = startSpaces;
	}

	static fromJson(obj: any) {
		return new Stage(obj.name, obj.grid, obj.startSpaces);
	}

	getStartSpaces(numPlayers: number) {
		let list = null as Point[] | null;
		for (const list2 of this.startSpaces) {
			if (list2.length >= numPlayers && (list == null || list2.length < list.length))
				list = list2;
		}
		return list!;
	}
}
