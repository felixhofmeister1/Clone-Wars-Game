// Copyright Echoes in the Drywall. All Rights Reserved.

#include "Environment/NonEuclideanShiftTrigger.h"

#include "Components/BoxComponent.h"
#include "DrawDebugHelpers.h"
#include "EchoesInTheDrywall.h"
#include "Engine/World.h"
#include "GameFramework/Controller.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/PlayerController.h"

namespace EchoShift
{
	/** Minimum gap between the arming and firing dot thresholds, so one glance can never do both. */
	constexpr float ArmingHysteresis = 0.2f;
}

ANonEuclideanShiftTrigger::ANonEuclideanShiftTrigger()
{
	PrimaryActorTick.bCanEverTick = true;
	// Ticks only while a player is inside the volume.
	PrimaryActorTick.bStartWithTickEnabled = false;

	TriggerVolume = CreateDefaultSubobject<UBoxComponent>(TEXT("TriggerVolume"));
	TriggerVolume->InitBoxExtent(FVector(200.0f, 200.0f, 150.0f));
	TriggerVolume->SetCollisionProfileName(TEXT("Trigger"));
	TriggerVolume->SetGenerateOverlapEvents(true);
	TriggerVolume->SetCanEverAffectNavigation(false);
	TriggerVolume->ShapeColor = FColor(160, 40, 255);
	RootComponent = TriggerVolume;

	SetCanBeDamaged(false);
}

void ANonEuclideanShiftTrigger::BeginPlay()
{
	Super::BeginPlay();

	ValidateActorLists();

	// Lets level designers build both layouts in place; the alternate one starts out of the world.
	if (bHideActorsToEnableOnBeginPlay)
	{
		SetActorsActive(ActorsToEnable, false);
	}

	if (!TriggerVolume)
	{
		UE_LOG(LogEchoes, Error, TEXT("%s: TriggerVolume is missing; the shift can only be triggered manually."), *GetName());
		return;
	}

	TriggerVolume->OnComponentBeginOverlap.AddUniqueDynamic(this, &ThisClass::HandleBeginOverlap);
	TriggerVolume->OnComponentEndOverlap.AddUniqueDynamic(this, &ThisClass::HandleEndOverlap);

	TrackOverlappingPlayer();
}

void ANonEuclideanShiftTrigger::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	StopTracking();

	Super::EndPlay(EndPlayReason);
}

void ANonEuclideanShiftTrigger::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	APawn* Pawn = TrackedPawn.Get();
	if (!Pawn || (bTriggerOnce && bHasTriggered))
	{
		StopTracking();
		return;
	}

	TimeInside += DeltaSeconds;

	float ViewDot = 0.0f;
	FVector ViewLocation = FVector::ZeroVector;
	if (!ComputeViewDot(*Pawn, ViewDot, ViewLocation))
	{
		return;
	}

	if (bDrawDebug)
	{
		DrawDebugState(ViewLocation, ViewDot);
	}

	if (!bArmed)
	{
		// The player has to take in the current space before it is allowed to change.
		const float ArmThreshold = FMath::Max(ArmingDotThreshold, BackTurnedDotThreshold + EchoShift::ArmingHysteresis);
		bArmed = ViewDot >= ArmThreshold;
		return;
	}

	// Camera forward vs direction to the focus: below the threshold the player's back is turned.
	if (TimeInside < MinTimeInsideBeforeShift || ViewDot >= BackTurnedDotThreshold)
	{
		return;
	}

	// Back is turned, but part of the affected geometry may still be on screen: wait until it is not.
	if (bRequireSwapActorsUnseen && AreAnySwapActorsVisible())
	{
		return;
	}

	PerformShift(Pawn);
}

void ANonEuclideanShiftTrigger::TriggerShift()
{
	PerformShift(TrackedPawn.Get());
}

void ANonEuclideanShiftTrigger::ResetShift()
{
	ApplyShiftState(false);
	bHasTriggered = false;
	bArmed = !bRequireFacingBeforeTurn;
	TimeInside = 0.0f;

	// Resume watching a player who is still standing inside.
	TrackOverlappingPlayer();
}

void ANonEuclideanShiftTrigger::AddActorToEnable(AActor* Actor)
{
	if (!Actor || Actor == this)
	{
		UE_LOG(LogEchoes, Warning, TEXT("%s: AddActorToEnable ignored an invalid actor."), *GetName());
		return;
	}

	ActorsToEnable.AddUnique(TWeakObjectPtr<AActor>(Actor));

	// Keep the newcomer consistent with the current layout.
	SetActorsActive({ TWeakObjectPtr<AActor>(Actor) }, bIsShifted);
}

void ANonEuclideanShiftTrigger::AddActorToDisable(AActor* Actor)
{
	if (!Actor || Actor == this)
	{
		UE_LOG(LogEchoes, Warning, TEXT("%s: AddActorToDisable ignored an invalid actor."), *GetName());
		return;
	}

	ActorsToDisable.AddUnique(TWeakObjectPtr<AActor>(Actor));
	SetActorsActive({ TWeakObjectPtr<AActor>(Actor) }, !bIsShifted);
}

FVector ANonEuclideanShiftTrigger::GetFocusLocation() const
{
	return GetActorTransform().TransformPosition(ShiftFocusOffset);
}

void ANonEuclideanShiftTrigger::HandleBeginOverlap(UPrimitiveComponent* /*OverlappedComponent*/, AActor* OtherActor,
	UPrimitiveComponent* /*OtherComp*/, int32 /*OtherBodyIndex*/, bool /*bFromSweep*/, const FHitResult& /*SweepResult*/)
{
	TryTrackPawn(Cast<APawn>(OtherActor));
}

void ANonEuclideanShiftTrigger::HandleEndOverlap(UPrimitiveComponent* /*OverlappedComponent*/, AActor* OtherActor,
	UPrimitiveComponent* /*OtherComp*/, int32 /*OtherBodyIndex*/)
{
	if (!OtherActor || OtherActor != TrackedPawn.Get())
	{
		return;
	}

	// A pawn can overlap with several components; only stop once none of them remain inside.
	if (TriggerVolume && TriggerVolume->IsOverlappingActor(OtherActor))
	{
		return;
	}

	StopTracking();
}

bool ANonEuclideanShiftTrigger::TryTrackPawn(APawn* Candidate)
{
	if (!Candidate || TrackedPawn.IsValid() || (bTriggerOnce && bHasTriggered))
	{
		return false;
	}

	// The shift is a perceptual trick, so only the local player's own view matters.
	const APlayerController* PlayerController = Candidate->GetController<APlayerController>();
	if (!PlayerController || !PlayerController->IsLocalController())
	{
		return false;
	}

	TrackedPawn = Candidate;
	TimeInside = 0.0f;
	bArmed = !bRequireFacingBeforeTurn;
	SetActorTickEnabled(true);
	return true;
}

void ANonEuclideanShiftTrigger::StopTracking()
{
	TrackedPawn.Reset();
	TimeInside = 0.0f;
	bArmed = false;
	SetActorTickEnabled(false);
}

void ANonEuclideanShiftTrigger::TrackOverlappingPlayer()
{
	if (!TriggerVolume || TrackedPawn.IsValid())
	{
		return;
	}

	TArray<AActor*> OverlappingPawns;
	TriggerVolume->GetOverlappingActors(OverlappingPawns, APawn::StaticClass());
	for (AActor* Candidate : OverlappingPawns)
	{
		if (TryTrackPawn(Cast<APawn>(Candidate)))
		{
			break;
		}
	}
}

bool ANonEuclideanShiftTrigger::ComputeViewDot(const APawn& Pawn, float& OutDot, FVector& OutViewLocation) const
{
	FRotator ViewRotation = FRotator::ZeroRotator;

	// For player controllers this is the camera manager's final point of view, i.e. the real camera.
	if (const AController* ViewController = Pawn.GetController())
	{
		ViewController->GetPlayerViewPoint(OutViewLocation, ViewRotation);
	}
	else
	{
		Pawn.GetActorEyesViewPoint(OutViewLocation, ViewRotation);
	}

	FVector ViewForward = ViewRotation.Vector();
	FVector ToFocus = GetFocusLocation() - OutViewLocation;
	if (bIgnoreVerticalAxis)
	{
		ViewForward.Z = 0.0f;
		ToFocus.Z = 0.0f;
	}

	// Undefined when looking straight up/down (yaw-only mode) or standing on the focus point.
	if (!ViewForward.Normalize() || !ToFocus.Normalize())
	{
		return false;
	}

	OutDot = static_cast<float>(FVector::DotProduct(ViewForward, ToFocus));
	return true;
}

bool ANonEuclideanShiftTrigger::AreAnySwapActorsVisible() const
{
	auto AnyOnScreen = [this](const TArray<TWeakObjectPtr<AActor>>& Actors)
	{
		for (const TWeakObjectPtr<AActor>& WeakActor : Actors)
		{
			const AActor* Actor = WeakActor.Get();
			if (Actor && !Actor->IsHidden() && Actor->WasRecentlyRendered(UnseenGraceSeconds))
			{
				return true;
			}
		}
		return false;
	};

	return AnyOnScreen(ActorsToDisable) || AnyOnScreen(ActorsToEnable);
}

void ANonEuclideanShiftTrigger::PerformShift(APawn* TriggeringPawn)
{
	ApplyShiftState(!bIsShifted);
	bHasTriggered = true;

	// Another flip needs the player to face the focus again; this also stops a flip every frame.
	bArmed = false;

	if (bTriggerOnce)
	{
		StopTracking();
	}

	UE_LOG(LogEchoes, Log, TEXT("%s: environment %s (witness: %s)."), *GetName(),
		bIsShifted ? TEXT("shifted") : TEXT("restored"), *GetNameSafe(TriggeringPawn));

	// Broadcast last so listeners (which may call ResetShift) see the final state.
	OnEnvironmentShifted.Broadcast(TriggeringPawn, bIsShifted);
}

void ANonEuclideanShiftTrigger::ApplyShiftState(bool bShifted)
{
	// ActorsToEnable is applied last, so it wins for an actor listed in both arrays.
	SetActorsActive(ActorsToDisable, !bShifted);
	SetActorsActive(ActorsToEnable, bShifted);
	bIsShifted = bShifted;
}

void ANonEuclideanShiftTrigger::SetActorsActive(const TArray<TWeakObjectPtr<AActor>>& Actors, bool bActive) const
{
	for (const TWeakObjectPtr<AActor>& WeakActor : Actors)
	{
		AActor* Actor = WeakActor.Get();
		if (!Actor || Actor == this)
		{
			continue;
		}

		Actor->SetActorHiddenInGame(!bActive);
		Actor->SetActorEnableCollision(bActive);
		if (bToggleActorTick)
		{
			Actor->SetActorTickEnabled(bActive);
		}
	}
}

void ANonEuclideanShiftTrigger::ValidateActorLists()
{
	auto Prune = [this](TArray<TWeakObjectPtr<AActor>>& Actors, const TCHAR* ListName)
	{
		const int32 Removed = Actors.RemoveAll([this](const TWeakObjectPtr<AActor>& WeakActor)
		{
			return !WeakActor.IsValid() || WeakActor.Get() == this;
		});

		if (Removed > 0)
		{
			UE_LOG(LogEchoes, Warning, TEXT("%s: removed %d empty or self-referencing entries from %s."), *GetName(), Removed, ListName);
		}
	};

	Prune(ActorsToEnable, TEXT("ActorsToEnable"));
	Prune(ActorsToDisable, TEXT("ActorsToDisable"));

	for (const TWeakObjectPtr<AActor>& WeakActor : ActorsToEnable)
	{
		if (ActorsToDisable.Contains(WeakActor))
		{
			UE_LOG(LogEchoes, Warning, TEXT("%s: %s is in both ActorsToEnable and ActorsToDisable; ActorsToEnable wins."),
				*GetName(), *GetNameSafe(WeakActor.Get()));
		}
	}

	if (ActorsToEnable.IsEmpty() && ActorsToDisable.IsEmpty())
	{
		UE_LOG(LogEchoes, Log, TEXT("%s: no actors to swap yet (add them in the Details panel or with AddActorToEnable/Disable)."), *GetName());
	}
}

void ANonEuclideanShiftTrigger::DrawDebugState(const FVector& ViewLocation, float ViewDot) const
{
#if ENABLE_DRAW_DEBUG
	const UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}

	const FVector Focus = GetFocusLocation();
	const bool bBackTurned = ViewDot < BackTurnedDotThreshold;
	const FColor Color = !bArmed ? FColor::Yellow : (bBackTurned ? FColor::Red : FColor::Green);
	const float AngleDegrees = FMath::RadiansToDegrees(FMath::Acos(FMath::Clamp(ViewDot, -1.0f, 1.0f)));

	DrawDebugLine(World, ViewLocation, Focus, Color, false, -1.0f, 0, 1.5f);
	DrawDebugSphere(World, Focus, 20.0f, 12, Color, false, -1.0f);

	// Duration 0 draws the label for a single frame, since this runs every tick.
	DrawDebugString(World, Focus + FVector(0.0f, 0.0f, 40.0f),
		FString::Printf(TEXT("%s | dot %.2f | %.0f deg"), bArmed ? TEXT("ARMED") : TEXT("waiting to be seen"), ViewDot, AngleDegrees),
		nullptr, Color, 0.0f, true);
#endif
}
