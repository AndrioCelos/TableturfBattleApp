enum StageSelectionMethod {
	Same,
	Vote,
	Random,
	Counterpick,
	Strike
}

interface StageSelectionRule {
	method: StageSelectionMethod;
	bannedStages: number[];
	strikeCounts: number[];
}
