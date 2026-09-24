// Copyright Echoes in the Drywall. All Rights Reserved.

using UnrealBuildTool;
using System.Collections.Generic;

public class EchoesInTheDrywallEditorTarget : TargetRules
{
	public EchoesInTheDrywallEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("EchoesInTheDrywall");
	}
}
