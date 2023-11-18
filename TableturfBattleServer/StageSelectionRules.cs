namespace TableturfBattleServer;

public class StageSelectionRules {
	public StageSelectionMethod Method { get; set; }
	public int[] BannedStages { get; set; }

	public StageSelectionRules(StageSelectionMethod method, int[]? bannedStages) {
		this.Method = method;
		this.BannedStages = bannedStages ?? Array.Empty<int>();
	}

	public static StageSelectionRules Default { get; } = new(StageSelectionMethod.Vote, Array.Empty<int>());
}

public enum StageSelectionMethod {
	/// <summary>The battle will be on the same stage as the last battle. This cannot be used for the first battle.</summary>
	Same,
	/// <summary>Each player votes for a stage, or random. One of the votes, chosen randomly, decides the stage.</summary>
	Vote,
	/// <summary>The stage is chosen randomly. If only one stage is allowed, all battles will be on that stage.</summary>
	Random,
	/// <summary>The loser of the last battle chooses the stage. This cannot be used for the first battle or after a draw.</summary>
	Counterpick,
	/// <summary>
	/// Players take turns to ban stages for the next match, until the final player chooses the stage from among the remaining ones.
	/// For the first battle or after a draw, players vote on who shall strike first. For subsequent battles, the winner of the last battle strikes first.
	/// </summary>
	Strike
}
