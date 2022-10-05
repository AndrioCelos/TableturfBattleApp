class CardButton {
	private static idNumber = 0;

	readonly element: HTMLLabelElement;
	readonly inputElement: HTMLInputElement;
	readonly card: Card;

	constructor(type: 'checkbox' | 'radio', card: Card) {
		this.card = card;

		let el = document.createElement('label');
		this.element = el;
		el.setAttribute('for', `card${CardButton.idNumber}`);
		el.setAttribute('type', 'checkbox')
		el.classList.add('card');
		el.classList.add([ 'common', 'rare', 'fresh' ][card.rarity]);

		let size = 0;
		let table = document.createElement('table');
		table.classList.add('cardGrid');
		for (var y = 0; y < 8; y++) {
			let tr = document.createElement('tr');
			table.appendChild(tr);
			for (var x = 0; x < 8; x++) {
				let td = document.createElement('td');
				if (card.grid[x][y] == Space.Ink1) {
					size++;
					td.classList.add('ink');
				} else if (card.grid[x][y] == Space.SpecialInactive1) {
					size++;
					td.classList.add('special');
				}
				tr.appendChild(td);
			}
		}

		let row = document.createElement('div');
		row.className = 'cardHeader';
		el.appendChild(row);

		let checkBox = document.createElement('input');
		this.inputElement = checkBox;
		checkBox.setAttribute('type', type)
		checkBox.id = `card${CardButton.idNumber}`;
		checkBox.dataset.number = card.number.toString();
		checkBox.addEventListener('change', e => {
			if (checkBox.checked)
				el.classList.add('checked');
			else
				el.classList.remove('checked');
		});
		row.appendChild(checkBox);

		let el2 = document.createElement('div');
		el2.classList.add('cardNumber');
		el2.innerText = card.number.toString();
		row.appendChild(el2);

		el2 = document.createElement('div');
		el2.classList.add('cardName');
		el2.innerText = card.name;
		row.appendChild(el2);

		el.appendChild(table);

		row = document.createElement('div');
		row.className = 'cardFooter';
		el.appendChild(row);


		el2 = document.createElement('div');
		el2.classList.add('cardSize');
		el2.innerText = size.toString();
		row.appendChild(el2);

		el2 = document.createElement('div');
		el2.classList.add('cardSpecialCost');
		row.appendChild(el2);

		for (let i = 1; i <= card.specialCost; i++) {
			const el3 = document.createElement('div');
			el3.classList.add('cardSpecialPoint');
			el3.innerText = i.toString();
			el2.appendChild(el3);
		}

		CardButton.idNumber++;
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
}
