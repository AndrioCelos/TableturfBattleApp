interface Config {
	apiBaseUrl: string,
	qrCodeGameUrl: string | null | undefined,
	qrCodeCorrectionLevel: QRCode.CorrectLevel | keyof typeof QRCode.CorrectLevel | undefined
}

declare var config: Config;
