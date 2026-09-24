// Copyright Echoes in the Drywall. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/HitResult.h"
#include "GameFramework/Actor.h"
#include "NonEuclideanShiftTrigger.generated.h"

class APawn;
class UBoxComponent;
class UPrimitiveComponent;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnEnvironmentShiftedSignature, APawn*, TriggeringPawn, bool, bIsShifted);

/**
 * Swaps sets of level actors behind the player's back.
 *
 * While a locally controlled player is inside the box, their camera forward is compared (dot product)
 * with the direction from the camera to the focus point. When the player looks away
 * (dot < BackTurnedDotThreshold, i.e. angle > ~135 degrees), ActorsToDisable are hidden and
 * ActorsToEnable are revealed. Optional guards make sure the swap is never witnessed.
 */
UCLASS(Blueprintable, meta = (DisplayName = "Non-Euclidean Shift Trigger"))
class ECHOESINTHEDRYWALL_API ANonEuclideanShiftTrigger : public AActor
{
	GENERATED_BODY()

public:
	ANonEuclideanShiftTrigger();

	//~ Begin AActor Interface
	virtual void Tick(float DeltaSeconds) override;
	//~ End AActor Interface

	/**
	 * Performs the swap now, bypassing the view checks (useful for sequences and debugging).
	 * Each call flips between the original and the shifted layout.
	 */
	UFUNCTION(BlueprintCallable, Category = "Echo|Shift")
	void TriggerShift();

	/** Restores the original layout and re-arms the trigger (e.g. after loading a checkpoint). */
	UFUNCTION(BlueprintCallable, Category = "Echo|Shift")
	void ResetShift();

	UFUNCTION(BlueprintCallable, Category = "Echo|Shift")
	void AddActorToEnable(AActor* Actor);

	UFUNCTION(BlueprintCallable, Category = "Echo|Shift")
	void AddActorToDisable(AActor* Actor);

	/** True while the shifted layout (ActorsToEnable visible) is active. */
	UFUNCTION(BlueprintPure, Category = "Echo|Shift")
	bool IsShifted() const { return bIsShifted; }

	UFUNCTION(BlueprintPure, Category = "Echo|Shift")
	bool IsPlayerInside() const { return TrackedPawn.IsValid(); }

	/** World-space point the player's view is measured against. */
	UFUNCTION(BlueprintPure, Category = "Echo|Shift")
	FVector GetFocusLocation() const;

	UPROPERTY(BlueprintAssignable, Category = "Echo|Shift")
	FOnEnvironmentShiftedSignature OnEnvironmentShifted;

protected:
	//~ Begin AActor Interface
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
	//~ End AActor Interface

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
	TObjectPtr<UBoxComponent> TriggerVolume;

	/** Revealed when the shift happens (the "after" version of the space). */
	UPROPERTY(EditAnywhere, Category = "Echo|Shift")
	TArray<TWeakObjectPtr<AActor>> ActorsToEnable;

	/** Hidden when the shift happens (the "before" version of the space). */
	UPROPERTY(EditAnywhere, Category = "Echo|Shift")
	TArray<TWeakObjectPtr<AActor>> ActorsToDisable;

	/**
	 * Point the view direction is measured against, relative to this actor. Defaults to the trigger's
	 * own location; drag the widget onto the doorway or corridor that is going to change.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Shift", meta = (MakeEditWidget = "true"))
	FVector ShiftFocusOffset = FVector::ZeroVector;

	/**
	 * Dot(camera forward, direction to focus) must drop below this for the swap.
	 * -0.7 is roughly 135 degrees away from the focus: the player has turned their back.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Shift|View", meta = (ClampMin = "-1.0", ClampMax = "1.0"))
	float BackTurnedDotThreshold = -0.7f;

	/**
	 * When true the trigger only arms after the player has looked towards the focus
	 * (dot >= ArmingDotThreshold), so they must see the original space before it changes.
	 * Re-triggering (bTriggerOnce = false) always requires looking back at the focus first.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Shift|View")
	bool bRequireFacingBeforeTurn = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Shift|View", meta = (ClampMin = "-1.0", ClampMax = "1.0", EditCondition = "bRequireFacingBeforeTurn"))
	float ArmingDotThreshold = 0.5f;

	/** Compare yaw only, so looking at the floor or ceiling never counts as turning around. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Shift|View")
	bool bIgnoreVerticalAxis = true;

	/** Seconds the player must spend inside the volume before a swap may happen. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Shift|View", meta = (ClampMin = "0.0", Units = "s"))
	float MinTimeInsideBeforeShift = 0.25f;

	/**
	 * Holds the swap while any affected actor was rendered on screen within UnseenGraceSeconds
	 * (mirrors, wide FOV, geometry spanning the view). The swap happens as soon as it is unobserved.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Shift|Safety")
	bool bRequireSwapActorsUnseen = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Shift|Safety", meta = (ClampMin = "0.0", Units = "s", EditCondition = "bRequireSwapActorsUnseen"))
	float UnseenGraceSeconds = 0.15f;

	/** Hides and disables ActorsToEnable at BeginPlay so both layouts can be built in place. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Shift|Setup")
	bool bHideActorsToEnableOnBeginPlay = true;

	/** Also toggles actor ticking on swapped actors. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Shift|Setup")
	bool bToggleActorTick = true;

	/**
	 * One-shot by default. When false, every time the player looks back at the focus and turns away
	 * again the layout flips, creating looping corridors.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Shift|Setup")
	bool bTriggerOnce = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Debug")
	bool bDrawDebug = false;

private:
	UFUNCTION()
	void HandleBeginOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor, UPrimitiveComponent* OtherComp,
		int32 OtherBodyIndex, bool bFromSweep, const FHitResult& SweepResult);

	UFUNCTION()
	void HandleEndOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor, UPrimitiveComponent* OtherComp,
		int32 OtherBodyIndex);

	/** Starts watching Candidate if it is a locally controlled player pawn. */
	bool TryTrackPawn(APawn* Candidate);
	void StopTracking();

	/** Picks up a player already inside the volume (no begin-overlap event is sent for them). */
	void TrackOverlappingPlayer();

	/** Dot between the pawn's camera forward and the direction to the focus. False if undefined. */
	bool ComputeViewDot(const APawn& Pawn, float& OutDot, FVector& OutViewLocation) const;

	bool AreAnySwapActorsVisible() const;

	void PerformShift(APawn* TriggeringPawn);
	void ApplyShiftState(bool bShifted);
	void SetActorsActive(const TArray<TWeakObjectPtr<AActor>>& Actors, bool bActive) const;
	void ValidateActorLists();

	void DrawDebugState(const FVector& ViewLocation, float ViewDot) const;

	TWeakObjectPtr<APawn> TrackedPawn;

	float TimeInside = 0.0f;
	bool bArmed = false;
	bool bIsShifted = false;
	bool bHasTriggered = false;
};
