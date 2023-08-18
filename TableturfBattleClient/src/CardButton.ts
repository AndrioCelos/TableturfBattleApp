/// <reference path="CheckButton.ts"/>

class CardButton extends CheckButton {
	private static idNumber = 0;

	readonly card: Card;

	constructor(card: Card) {
		let button = document.createElement('button');
		button.type = 'button';
		button.classList.add('card');
		button.classList.add([ 'common', 'rare', 'fresh' ][card.rarity]);
		if (card.number < 0) button.classList.add('upcoming');
		button.dataset.cardNumber = card.number.toString();
		super(button);

		this.card = card;

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
		button.appendChild(row);

		let el2 = document.createElement('div');
		el2.classList.add('cardNumber');
		el2.innerText = card.number >= 0 ? `No. ${card.number}` : 'Upcoming';
		row.appendChild(el2);

		el2 = document.createElement('div');
		el2.classList.add('cardName');
		el2.innerText = card.name;
		row.appendChild(el2);

		button.appendChild(table);

		row = document.createElement('div');
		row.className = 'cardFooter';
		button.appendChild(row);


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
}
