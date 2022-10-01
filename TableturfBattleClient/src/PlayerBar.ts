class PlayerBar {
	readonly playerIndex: number;

	private nameElement: HTMLElement;
	private specialPointsContainer: HTMLElement;
	private pointsElement: HTMLElement;
	private pointsContainer: HTMLElement;
	private pointsToContainer: HTMLElement;
	private pointsToElement: HTMLElement;
	private pointsDeltaElement: HTMLElement;

	resultElement: HTMLElement;
	statSpecialPointsElement: HTMLElement;
	statPassesElement: HTMLElement;

	constructor(element: HTMLDivElement) {
		this.playerIndex = parseInt(element.dataset.index!);
		if (isNaN(this.playerIndex))
			throw new Error('Missing player index');
		this.nameElement = element.getElementsByClassName('name')[0] as HTMLElement;
		this.specialPointsContainer = element.getElementsByClassName('specialPoints')[0] as HTMLElement;

		let pointsContainer: HTMLElement | null = null;
		for (const el of document.getElementsByClassName('pointsContainer')) {
			if ((el as HTMLElement).dataset.index == element.dataset.index) {
				pointsContainer = el as HTMLElement;
				break;
			}
		}
		if (pointsContainer == null)
		throw new Error(`pointsContainer with index ${element.dataset.index} not found`);
		this.pointsContainer = pointsContainer;

		this.pointsElement = pointsContainer.getElementsByClassName('points')[0] as HTMLElement;
		this.pointsToContainer = pointsContainer.getElementsByClassName('pointsToContainer')[0] as HTMLElement;
		this.pointsToElement = pointsContainer.getElementsByClassName('pointsTo')[0] as HTMLElement;
		this.pointsDeltaElement = pointsContainer.getElementsByClassName('pointsDelta')[0] as HTMLElement;

		this.resultElement = element.getElementsByClassName('result')[0] as HTMLElement;
		this.statSpecialPointsElement = element.querySelector('.statSpecialPoints .statValue')!;
		this.statPassesElement = element.querySelector('.statPasses .statValue')!;
	}

	get name() { return this.nameElement.innerText; }
	set name(value: string) { this.nameElement.innerText = value; }

	get points() { return parseInt(this.pointsElement.innerText); }
	set points(value: number) { this.pointsElement.innerText = value.toString(); }

	get specialPoints() { return this.specialPointsContainer.getElementsByClassName('specialPoint').length; }
	set specialPoints(value: number) {
		const oldList = this.specialPointsContainer.getElementsByClassName('specialPoint');
		if (value < oldList.length) {
			for (let i = oldList.length - 1; i >= value; i--)
				this.specialPointsContainer.removeChild(oldList[i]);
		} else if (value > oldList.length) {
			for (let i = oldList.length; i < value; i++) {
				const el = document.createElement('div');
				el.classList.add('specialPoint');
				el.innerText = `${i + 1}`;
				this.specialPointsContainer.appendChild(el);
			}
		}
	}

	get pointsTo() { return this.pointsToContainer.hidden ? null : parseInt(this.pointsToElement.innerText); }
	set pointsTo(value: number | null) {
		if (value == null || value == 0)  // A player can never actually have 0 points because they start with a permanent special space.
			this.pointsToContainer.hidden = true;
		else {
			this.pointsToContainer.hidden = false;
			this.pointsToElement.innerText = value.toString();
		}
	}

	get pointsDelta() { return this.pointsDeltaElement.hidden ? null : parseInt(this.pointsDeltaElement.innerText); }
	set pointsDelta(value: number | null) {
		if (value == null || value == 0)
			this.pointsDeltaElement.hidden = true;
		else {
			this.pointsDeltaElement.hidden = false;
			if (value > 0)
				this.pointsDeltaElement.innerText = `+${value}`;
			else
				this.pointsDeltaElement.innerText = value.toString();
		}
	}
}
