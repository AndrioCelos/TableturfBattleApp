class TimeLabel {
	containerElement: HTMLElement;
	contentElement: HTMLElement;
	element: HTMLElement;

	ontimeout: (() => void) | null = null;

	private interval: number | null = null;
	private timeLeft: number | null = null;
	private _faded = false;
	private _paused = false;

	constructor(element: HTMLElement) {
		this.element = element;
		this.contentElement = element.parentElement!;
		this.containerElement = this.contentElement.parentElement!;
	}

	setTime(value: number) {
		this.timeLeft = value;
		if (!this.paused) {
			this.element.innerText = value.toString();
			this.updateWarningState();
		}
		if (this.interval != null) clearInterval(this.interval);
		this.interval = setInterval(this.tick.bind(this), 1000);
	}

	hide() {
		if (this.interval != null) {
			clearInterval(this.interval);
			this.interval = null;
		}
		this.containerElement.hidden = true;
	}

	show() {
		this.containerElement.hidden = false;
	}

	get faded() { return this._faded; }
	set faded(value) {
		this._faded = value;
		if (value)
			this.contentElement.classList.add('faded');
		else
			this.contentElement.classList.remove('faded');
		this.updateWarningState();
	}

	public get paused() { return this._paused; }
	public set paused(value) {
		this._paused = value;
		if (!value && this.timeLeft != null) {
			this.element.innerText = this.timeLeft.toString();
			this.updateWarningState();
		}
	}

	private tick() {
		if (this.timeLeft != null && this.timeLeft > 0) {
			this.timeLeft--;
			if (this.timeLeft == 0) {
				clearInterval(this.interval!);
				this.interval = null;
				if (this.ontimeout)
					this.ontimeout();
			}
			if (!this.paused) {
				this.element.innerText = this.timeLeft.toString();
				this.updateWarningState();
			}
		}
	}

	private updateWarningState() {
		if (!this.faded && this.timeLeft != null && this.timeLeft <= 10) {
			this.contentElement.classList.add('warning');
			resetAnimation(this.contentElement);
		} else
			this.contentElement.classList.remove('warning');
	}
}
