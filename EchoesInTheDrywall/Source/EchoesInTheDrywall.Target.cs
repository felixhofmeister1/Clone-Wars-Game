// Copyright Echoes in the Drywall. All Rights Reserved.

using UnrealBuildTool;
using System.Collections.Generic;

public class EchoesInTheDrywallTarget : TargetRules
{
	public EchoesInTheDrywallTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("EchoesInTheDrywall");
	}
}
