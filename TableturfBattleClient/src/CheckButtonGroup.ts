/** A group of {@link CheckButton} instances that are used as a radio button group. */
class CheckButtonGroup<TValue> {
	entries: Array<{ button: CheckButton, value: TValue }> = [ ];
	parentElement: HTMLElement | null;
	value: TValue | null = null;

	constructor(parentElement?: HTMLElement | null) {
		this.parentElement = parentElement ?? null;
	}

	get buttons() { return this.entries.map(el => el.button); }

	private setupButton(button: CheckButton, value: TValue) {
		button.buttonElement.addEventListener('click', () => {
			if (button.enabled && !button.checked) {
				for (const el of this.entries) {
					if (el.button == button) {
						el.button.checked = true;
						this.value = value;
					} else
						el.button.checked = false;
				}
			}
		});
	}

	add(button: CheckButton, value: TValue) {
		this.entries.push({ button, value });
		this.setupButton(button, value);
		this.parentElement?.appendChild(button.buttonElement);
	}

	replace(index: number, button: CheckButton, value: TValue) {
		this.entries[index] = { button, value };
		this.setupButton(button, value);
		// The caller is responsible for adding the button to the DOM.
	}

	clear() {
		if (this.parentElement) {
			for (const button of this.buttons)
				this.parentElement.removeChild(button.buttonElement);
		}
		this.entries.splice(0);
	}

	deselect() {
		for (const el of this.entries)
			el.button.checked = false;
		this.value = null;
	}
}
