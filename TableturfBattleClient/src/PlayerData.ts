interface PlayerData {
	playerIndex: number;
	hand: Card[] | null;
	deck: Deck | null;
	cardsUsed: number[];
	move: Move | null;
	stageSelectionPrompt: StageSelectionPrompt | null;
}

interface StageSelectionPrompt {
	promptType: StageSelectionPromptType;
	numberOfStagesToStrike: number;
	struckStages: number[] | null;
	bannedStages: number[] | null;
}

enum StageSelectionPromptType {
	Vote,
	VoteOrder,
	Strike,
	Choose,
	Wait
}
