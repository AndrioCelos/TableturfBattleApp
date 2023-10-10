/// <reference path="CheckButton.ts"/>

class CardButton extends CheckButton {
	private static idNumber = 0;

	readonly card: Card;

	constructor(card: Card) {
		let button = document.createElement('button');
		button.type = 'button';
		button.classList.add('cardButton');
		button.classList.add([ 'common', 'rare', 'fresh' ][card.rarity]);
		if (card.number < 0) button.classList.add('upcoming');
		button.dataset.cardNumber = card.number.toString();
		super(button);

		this.card = card;

		const gridSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		gridSvg.classList.add('cardGrid');
		gridSvg.setAttribute('viewBox', '0 0 800 800');
		CardDisplay.CreateSvgCardGrid(card, gridSvg);

		if (card.imageUrl) {
			const bgDiv = document.createElement('div');
			bgDiv.setAttribute('class', 'cardArt');
			bgDiv.style.backgroundImage = `url(${card.imageUrl})`;
			button.appendChild(bgDiv);
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

		button.appendChild(gridSvg);

		row = document.createElement('div');
		row.className = 'cardFooter';
		button.appendChild(row);


		el2 = document.createElement('div');
		el2.classList.add('cardSize');
		el2.innerText = card.size.toString();
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
