class StageButton {
	private static idNumber = 0;

	readonly element: HTMLLabelElement;
	readonly inputElement: HTMLInputElement;
	readonly stage: Stage;

	readonly cells: HTMLTableCellElement[][];
	private readonly startCells: HTMLTableCellElement[] = [ ];

	constructor(stage: Stage) {
		this.stage = stage;

		let el = document.createElement('label');
		this.element = el;
		el.setAttribute('for', `stage${StageButton.idNumber}`);
		el.classList.add('stage');

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
		el.appendChild(row);

		let checkBox = document.createElement('input');
		this.inputElement = checkBox;
		checkBox.setAttribute('type', 'radio');
		checkBox.setAttribute('value', stage.name);
		checkBox.id = `stage${StageButton.idNumber}`;
		checkBox.dataset.name = stage.name;
		checkBox.addEventListener('change', e => {
			if (checkBox.checked)
				el.classList.add('checked');
			else
				el.classList.remove('checked');
		});
		row.appendChild(checkBox);

		let el2 = document.createElement('div');
		el2.classList.add('stageName');
		el2.innerText = stage.name;
		row.appendChild(el2);

		row = document.createElement('div');
		row.className = 'stageBody';
		el.appendChild(row);
		row.appendChild(table);

		StageButton.idNumber++;
	}

	get enabled() { return !this.inputElement.disabled; }
	set enabled(value: boolean) {
		this.inputElement.disabled = !value;
		if (value)
			this.element.classList.remove('disabled');
		else
			this.element.classList.add('disabled');
	}

	get checked() { return this.inputElement.checked; }
	set checked(value: boolean) {
		this.inputElement.checked = value;
		if (this.inputElement.checked)
			this.element.classList.add('checked');
		else
			this.element.classList.remove('checked');
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
