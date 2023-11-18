namespace TableturfBattleServer;
public struct StageSelectionPrompt {
	public StageSelectionPromptType PromptType;
	public int NumberOfStagesToStrike;
	public ICollection<int> StruckStages;
	public ICollection<int> BannedStages;
}

public enum StageSelectionPromptType {
	/// <summary>The player is prompted to vote for a stage.</summary>
	Vote,
	/// <summary>The player is prompted to vote for whether to strike first or second.</summary>
	VoteOrder,
	/// <summary>The player is prompted to choose stages to strike.</summary>
	Strike,
	/// <summary>The player is prompted to choose the stage.</summary>
	Choose,
	/// <summary>It is another player's turn to make a choice.</summary>
	Wait
}
