interface AppConfig {
	apiBaseUrl: string,
	qrCodeGameUrl: string | null | undefined,
	qrCodeCorrectionLevel: QRCode.CorrectLevel | keyof typeof QRCode.CorrectLevel | undefined,
	discordUrl?: string,
	discordTitle?: string
}

enum SpecialWeaponSorting {
	First,
	Last,
	InOrder
}

class Config {
	name: string | null = null;
	colourLock = true;
	absoluteTurnNumber = false;
	specialWeaponSorting = SpecialWeaponSorting.First;
	lastCustomRoomConfig?: CustomRoomConfig;
}

interface CustomRoomConfig {
	maxPlayers: number;
	turnTimeLimit: number | null;
	goalWinCount: number | null;
	stageSelectionMethodFirst: StageSelectionMethod;
	stageSelectionMethodAfterWin: StageSelectionMethod | null;
	stageSelectionMethodAfterDraw: StageSelectionMethod | null;
	forceSameDecksAfterDraw: boolean;
	stageSwitch: number[];
	spectate: boolean;
}

declare var config: AppConfig;
declare var polyfillActive: boolean;

let userConfig = new Config();

{
	const configString = localStorage.getItem('settings');
	if (configString) {
		const configDict = JSON.parse(configString);
		for (const k in configDict)
			(userConfig as any)[k] = configDict[k];
	}
}

function saveSettings() {
	localStorage.setItem('settings', JSON.stringify(userConfig));
}
