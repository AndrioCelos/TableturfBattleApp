class StageButton extends CheckButton {
	private static idNumber = 0;

	readonly stage: Stage;
	readonly cells: HTMLTableCellElement[][];
	private readonly startCells: HTMLTableCellElement[] = [ ];

	constructor(stage: Stage) {
		let button = document.createElement('button');
		button.type = 'button';
		button.classList.add('stage');
		super(button);

		this.stage = stage;

		let cols: HTMLTableCellElement[][] = [ ];
		for (let x = 0; x < stage.grid.length; x++) {
			let col = [ ];
			for (let y = 0; y < stage.grid[x].length; y++) {
				let td = document.createElement('td');
				if (stage.grid[x][y] == Space.OutOfBounds)
					td.classList.add('OutOfBounds');
				else
					td.classList.add('Empty');
				col.push(td);
			}
			cols.push(col);
		}
		this.cells = cols;

		let table = document.createElement('table');
		table.classList.add('stageGrid');
		for (let y = 0; y < stage.grid[0].length; y++) {
			let tr = document.createElement('tr');
			table.appendChild(tr);
			for (let x = 0; x < stage.grid.length; x++) {
				tr.appendChild(cols[x][y]);
			}
		}

		let row = document.createElement('div');
		row.className = 'stageHeader';
		button.appendChild(row);

		let el2 = document.createElement('div');
		el2.classList.add('stageName');
		el2.innerText = stage.name;
		row.appendChild(el2);

		row = document.createElement('div');
		row.className = 'stageBody';
		button.appendChild(row);
		row.appendChild(table);

		StageButton.idNumber++;
	}

	setStartSpaces(numPlayers: number) {
		for (const td of this.startCells) {
			td.classList.remove('Start1');
			td.classList.remove('Start2');
			td.classList.remove('Start3');
			td.classList.remove('Start4');
			td.classList.add('Empty');
		}
		this.startCells.splice(0);

		const startSpaces = this.stage.getStartSpaces(numPlayers);
		for (let i = 0; i < numPlayers; i++) {
			const td = this.cells[startSpaces[i].x][startSpaces[i].y];
			td.classList.remove('Empty');
			td.classList.add(`Start${i + 1}`);
			this.startCells.push(td);
		}
	}
}
