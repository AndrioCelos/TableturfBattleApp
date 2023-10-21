class CardDisplay {
	readonly card: Card;
	readonly element: SVGSVGElement;

	constructor(card: Card, level: number) {
		let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', '0 0 635 885');
		svg.setAttribute('alt', card.name);
		this.element = svg;

		svg.classList.add('card');
		svg.classList.add([ 'common', 'rare', 'fresh' ][card.rarity]);
		if (card.number < 0) svg.classList.add('upcoming');
		svg.dataset.cardNumber = card.number.toString();
		svg.style.setProperty("--number", card.number.toString());

		// Background
		const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
		image.setAttribute('href', `assets/CardBackground-${card.rarity}-${level > 0 ? '1' : '0'}.webp`);
		image.setAttribute('width', '100%');
		image.setAttribute('height', '100%');
		svg.appendChild(image);

		if (level == 0) {
			svg.insertAdjacentHTML('beforeend', `<image href="assets/external/CardInk.webp" width="635" height="885" clip-path="url(#myClip)"/>`);
		} else {
			svg.insertAdjacentHTML('beforeend', `
				<filter id="ink1-${card.number}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${card.inkColour1.r / 255} 0 0 0 0 0 ${card.inkColour1.g / 255} 0 0 0 0 0 ${card.inkColour1.b / 255} 0 0 0 0 0 0.88 0"/></filter>
				<image href="assets/external/CardInk-1.webp" width="635" height="885" clip-path="url(#myClip)" filter="url(#ink1-${card.number})"/>
				<filter id="ink2-${card.number}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${card.inkColour2.r / 255} 0 0 0 0 0 ${card.inkColour2.g / 255} 0 0 0 0 0 ${card.inkColour2.b / 255} 0 0 0 0 0 0.88 0"/></filter>
				<image href="assets/external/CardInk-2.webp" width="635" height="885" clip-path="url(#myClip)" filter="url(#ink2-${card.number})"/>
			`);
		}

		// Art
		if (card.imageUrl) {
			const image2 = document.createElementNS('http://www.w3.org/2000/svg', 'image');
			image2.setAttribute('class', 'cardArt');
			image2.setAttribute('href', card.imageUrl);
			image2.setAttribute('width', '100%');
			image2.setAttribute('height', '100%');
			svg.appendChild(image2);
		}

		// Grid
		const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		g.setAttribute('transform', 'translate(380 604) rotate(6.5) scale(0.283)');
		svg.appendChild(g);

		CardDisplay.CreateSvgCardGrid(card, g);

		// Name
		const text1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		text1.setAttribute('class', 'cardDisplayName');
		text1.setAttribute('x', '50%');
		text1.setAttribute('y', '168');
		text1.setAttribute('font-size', '76');
		text1.setAttribute('font-weight', 'bold');
		text1.setAttribute('stroke', 'black');
		text1.setAttribute('stroke-width', '15');
		text1.setAttribute('stroke-linejoin', 'round');
		text1.setAttribute('paint-order', 'stroke');
		text1.setAttribute('word-spacing', '-10');
		text1.setAttribute('transform-origin', 'center');
		text1.setAttribute('transform', `scale(${card.textScale} 1)`);
		switch (card.rarity) {
			case Rarity.Common:
				text1.setAttribute('fill', '#6038FF');
				break;
			case Rarity.Rare:
				svg.insertAdjacentHTML('beforeend', `
					<linearGradient id='rareGradient' y1='25%' spreadMethod='reflect'>
						<stop offset='0%' stop-color='#FEF9C6'/>
						<stop offset='50%' stop-color='#DFAF17'/>
						<stop offset='100%' stop-color='#FEF9C6'/>
					</linearGradient>
				`);
				text1.setAttribute('fill', 'url("#rareGradient")');
				break;
			case Rarity.Fresh:
				svg.insertAdjacentHTML('beforeend', `
					<linearGradient id='freshGradient' y2='25%'>
						<stop offset='0%' stop-color='#FF8EDD'/>
						<stop offset='25%' stop-color='#FFEC9F'/>
						<stop offset='50%' stop-color='#B84386'/>
						<stop offset='75%' stop-color='#2BEFC8'/>
						<stop offset='100%' stop-color='#FF8EDD'/>
					</linearGradient>
				`);
				text1.setAttribute('fill', 'url("#freshGradient")');
				break;
		}
		if (card.line1 && card.line2) {
			const tspan1 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
			tspan1.setAttribute('y', '122');
			tspan1.appendChild(document.createTextNode(card.line1));
			text1.appendChild(tspan1);

			const tspan2 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
			tspan2.setAttribute('x', '50%');
			tspan2.setAttribute('y', '216');
			tspan2.appendChild(document.createTextNode(card.line2));
			text1.appendChild(tspan2);
		} else
			text1.innerHTML = card.name;

		svg.appendChild(text1);

		// Size
		svg.insertAdjacentHTML('beforeend', `<image href='assets/external/Game Assets/CardCost_0${card.rarity}.png' width='80' height='80' transform='translate(12 798) rotate(-45) scale(1.33)'/>`);
		svg.insertAdjacentHTML('beforeend', `<text fill='white' stroke='${card.rarity == Rarity.Common ? '#482BB4' : card.rarity == Rarity.Rare ? '#8B7E25' : '#481EF9'}' paint-order='stroke' stroke-width='5' font-size='48' y='816' x='87'>${card.size}</text>`);

		// Special cost
		const g2 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		g2.setAttribute('class', 'specialCost');
		g2.setAttribute('transform', 'translate(170 806) scale(0.32)');
		svg.appendChild(g2);

		for (let i = 0; i < card.specialCost; i++) {
			let rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
			image.setAttribute('href', 'assets/SpecialOverlay.png');
			for (const el of [ rect, image ]) {
				el.setAttribute('x', (110 * (i % 5)).toString());
				el.setAttribute('y', (-125 * Math.floor(i / 5)).toString());
				el.setAttribute('width', '95');
				el.setAttribute('height', '95');
				g2.appendChild(el);
			}
		}

		this.card = card;
	}

	static CreateSvgCardGrid(card: Card, parent: SVGElement) {
		for (var y = 0; y < 8; y++) {
			for (var x = 0; x < 8; x++) {
				if (card.grid[x][y] == Space.Empty) {
					const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
					rect.classList.add('empty');
					rect.setAttribute('x', (100 * x + 3).toString());
					rect.setAttribute('y', (100 * y + 3).toString());
					rect.setAttribute('width', '94');
					rect.setAttribute('height', '94');
					parent.appendChild(rect);
				} else {
					const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
					rect.classList.add(card.grid[x][y] == Space.SpecialInactive1 ? 'special' : 'ink');
					const elements: Element[] = [rect];
					const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
					image.setAttribute('href', card.grid[x][y] == Space.SpecialInactive1 ? 'assets/SpecialOverlay.png' : 'assets/InkOverlay.png');
					elements.push(image);

					for (const el of elements) {
						el.setAttribute('x', (100 * x).toString());
						el.setAttribute('y', (100 * y).toString());
						el.setAttribute('width', '100');
						el.setAttribute('height', '100');
						parent.appendChild(el);
					}
				}
			}
		}
	}
}