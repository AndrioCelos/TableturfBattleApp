class HintLabel {
	private static readonly CLASS_NAME_ERROR = 'hintError';
	private static readonly CLASS_NAME_SPECIAL = 'hintSpecial';
	private static readonly CLASS_NAME_REPEATED = 'repeated';

	readonly element: HTMLElement;

	private _isSpecial = false;
	private _errorTimeout: number | null = null;
	private _baseHtml: string | null = null;

	constructor(element: HTMLElement) {
		this.element = element;
	}

	static fromId(id: string) { return new HintLabel(document.getElementById(id)!); }

	private clearError() {
		if (this._errorTimeout) {
			clearTimeout(this._errorTimeout);
			this._errorTimeout = null;
		}
	}

	show(html: string, isSpecial: boolean) {
		this._baseHtml = html;
		this._isSpecial = isSpecial;
		this.clearError();
		this.element.classList.remove(HintLabel.CLASS_NAME_ERROR);
		this.element.classList.remove(HintLabel.CLASS_NAME_REPEATED);
		if (isSpecial)
			this.element.classList.add(HintLabel.CLASS_NAME_SPECIAL);
		else
			this.element.classList.remove(HintLabel.CLASS_NAME_SPECIAL);
		this.element.innerHTML = html;
		this.element.hidden = false;
	}

	clear() {
		this._baseHtml = null;
		this._isSpecial = false;
		clearChildren(this.element);
		this.clearError();
		this.element.hidden = true;
		this.element.classList.remove(HintLabel.CLASS_NAME_ERROR);
		this.element.classList.remove(HintLabel.CLASS_NAME_REPEATED);
		this.element.classList.remove(HintLabel.CLASS_NAME_SPECIAL);
	}

	showError(html: string) {
		if (this._errorTimeout != null && html == this.element.innerHTML) {
			this.element.classList.add(HintLabel.CLASS_NAME_REPEATED);
			resetAnimation(this.element);
		} else
			this.element.classList.remove(HintLabel.CLASS_NAME_REPEATED);
		this.clearError();
		this.element.classList.remove(HintLabel.CLASS_NAME_SPECIAL);
		this.element.classList.add(HintLabel.CLASS_NAME_ERROR);
		this.element.innerHTML = html;
		this.element.hidden = false;
		this._errorTimeout = setTimeout((() => {
			this._errorTimeout = null;
			this.element.classList.remove(HintLabel.CLASS_NAME_ERROR);
			this.element.classList.remove(HintLabel.CLASS_NAME_REPEATED);
			if (this._baseHtml) {
				if (this._isSpecial)
					this.element.classList.add(HintLabel.CLASS_NAME_SPECIAL);
				this.element.innerHTML = this._baseHtml;
			} else {
				this.element.hidden = true;
				clearChildren(this.element);
			}
		}).bind(this), 5000);
	}
}
