declare class QRCode {
	constructor(el: HTMLElement | string, vOption: string | {
		width: number | undefined,
		height: number | undefined,
		colorDark: string | undefined,
		colorLight: string | undefined,
		correctLevel: QRCode.CorrectLevel | undefined
	} | undefined);

	makeCode(sText: string) : void;
	clear() : void;

}

declare namespace QRCode {
	enum CorrectLevel { M, L, H, Q }
}
