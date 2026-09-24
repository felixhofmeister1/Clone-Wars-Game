// Copyright Echoes in the Drywall. All Rights Reserved.

using UnrealBuildTool;

public class EchoesInTheDrywall : ModuleRules
{
	public EchoesInTheDrywall(ReadOnlyTargetRules Target) : base(Target)
	{
		// Explicit/shared PCHs keep the module IWYU-clean: every .cpp includes what it uses.
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"InputCore",
			"EnhancedInput",
			"AudioExtensions"
		});

		PrivateDependencyModuleNames.AddRange(new string[] { });
	}
}
