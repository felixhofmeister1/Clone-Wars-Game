// Copyright Echoes in the Drywall. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "BreathingComponent.generated.h"

class USoundBase;

/** Why the owner lost control of their breathing. */
UENUM(BlueprintType)
enum class EForcedGaspReason : uint8
{
	/** The breath was held until the lungs ran dry. */
	BreathExhausted UMETA(DisplayName = "Breath Exhausted"),

	/** The breath was released while panic was above the high-panic threshold. */
	PanickedRelease UMETA(DisplayName = "Panicked Release")
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnForcedGaspSignature, EForcedGaspReason, Reason, float, PanicAfterGasp);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnPanicChangedSignature, float, NewPanic, float, PreviousPanic);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnBreathHoldChangedSignature, bool, bIsHoldingBreath);

/**
 * Tracks the owner's panic (0-100) and breath-holding.
 *
 * Holding breath makes the owner quieter (see GetNoiseMultiplier) but drains breath capacity,
 * faster when panicked. Running out of breath, or letting go while panic is high, triggers a
 * forced gasp: the hold ends, panic spikes, an AI-audible noise is emitted and OnForcedGasp fires.
 */
UCLASS(ClassGroup = (Echoes), meta = (BlueprintSpawnableComponent))
class ECHOESINTHEDRYWALL_API UBreathingComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UBreathingComponent();

	/** Upper bound of the panic scale. */
	static constexpr float MaxPanic = 100.0f;

	//~ Begin UActorComponent Interface
	virtual void InitializeComponent() override;
	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;
	//~ End UActorComponent Interface

	/** Starts holding breath. Returns false while recovering from a gasp or without enough breath left. */
	UFUNCTION(BlueprintCallable, Category = "Echo|Breathing")
	bool StartHoldingBreath();

	/** Voluntarily lets go. Under high panic this becomes a forced gasp instead of a quiet exhale. */
	UFUNCTION(BlueprintCallable, Category = "Echo|Breathing")
	void StopHoldingBreath();

	/** Adds panic (negative values calm the owner). Positive amounts restart the decay delay. */
	UFUNCTION(BlueprintCallable, Category = "Echo|Panic")
	void AddPanic(float Amount);

	/** Sets panic directly, clamped to [0, 100]. */
	UFUNCTION(BlueprintCallable, Category = "Echo|Panic")
	void SetPanic(float NewPanic);

	UFUNCTION(BlueprintPure, Category = "Echo|Panic")
	float GetPanic() const { return CurrentPanic; }

	/** Panic remapped to [0, 1], handy for post-process weights and audio parameters. */
	UFUNCTION(BlueprintPure, Category = "Echo|Panic")
	float GetPanicNormalized() const { return CurrentPanic / MaxPanic; }

	UFUNCTION(BlueprintPure, Category = "Echo|Panic")
	bool IsPanicHigh() const { return CurrentPanic >= HighPanicThreshold; }

	UFUNCTION(BlueprintPure, Category = "Echo|Breathing")
	bool IsHoldingBreath() const { return bIsHoldingBreath; }

	UFUNCTION(BlueprintPure, Category = "Echo|Breathing")
	bool IsRecoveringFromGasp() const { return GaspRecoveryRemaining > 0.0f; }

	UFUNCTION(BlueprintPure, Category = "Echo|Breathing")
	bool CanHoldBreath() const;

	/** Seconds the current hold has lasted (0 when not holding). */
	UFUNCTION(BlueprintPure, Category = "Echo|Breathing")
	float GetCurrentHoldTime() const { return CurrentHoldTime; }

	/** Remaining breath capacity in [0, 1]; drive a breath meter or a muffled-audio mix with it. */
	UFUNCTION(BlueprintPure, Category = "Echo|Breathing")
	float GetBreathRemainingNormalized() const;

	/**
	 * Loudness multiplier for noises the owner makes (footsteps, AI hearing reports).
	 * Quiet while holding breath, louder when panicked or gasping for air.
	 */
	UFUNCTION(BlueprintPure, Category = "Echo|Breathing")
	float GetNoiseMultiplier() const;

	/** Fires when breath control is lost (held too long, or released while panicking). */
	UPROPERTY(BlueprintAssignable, Category = "Echo|Breathing")
	FOnForcedGaspSignature OnForcedGasp;

	UPROPERTY(BlueprintAssignable, Category = "Echo|Breathing")
	FOnBreathHoldChangedSignature OnBreathHoldChanged;

	UPROPERTY(BlueprintAssignable, Category = "Echo|Panic")
	FOnPanicChangedSignature OnPanicChanged;

	// ---------------------------------------------------------------- Panic tuning

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Panic", meta = (ClampMin = "0.0", ClampMax = "100.0"))
	float InitialPanic = 0.0f;

	/** Panic never decays below this. Raise it from Blueprint in oppressive areas. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Panic", meta = (ClampMin = "0.0", ClampMax = "100.0"))
	float PanicFloor = 0.0f;

	/** At or above this, releasing a held breath turns into a forced gasp. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Panic", meta = (ClampMin = "0.0", ClampMax = "100.0"))
	float HighPanicThreshold = 70.0f;

	/** Panic lost per second once the decay delay has passed. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Panic", meta = (ClampMin = "0.0"))
	float PanicDecayRate = 4.0f;

	/** Seconds after the last panic increase before panic starts to decay. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Panic", meta = (ClampMin = "0.0", Units = "s"))
	float PanicDecayDelay = 3.0f;

	/**
	 * Panic gained per second while holding breath (the body protests). Opt-in: any value above 0
	 * also speeds up the drain (see PanicBreathDrainMultiplier), so a calm breath ends before MaxBreathHoldDuration.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Panic", meta = (ClampMin = "0.0"))
	float PanicGainWhileHoldingBreath = 0.0f;

	/** Tension spike applied by every forced gasp. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Panic", meta = (ClampMin = "0.0", ClampMax = "100.0"))
	float ForcedGaspPanicSpike = 25.0f;

	// ---------------------------------------------------------------- Breath tuning

	/** Breath capacity in seconds: a calm, full breath can be held this long before a forced gasp. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Breathing", meta = (ClampMin = "0.5", Units = "s"))
	float MaxBreathHoldDuration = 6.0f;

	/** Extra drain at 100 panic: capacity drains at (1 + PanicNormalized * this) seconds per second. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Breathing", meta = (ClampMin = "0.0"))
	float PanicBreathDrainMultiplier = 0.5f;

	/** Seconds of capacity regained per second while breathing normally. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Breathing", meta = (ClampMin = "0.0"))
	float BreathRecoveryRate = 1.5f;

	/** Capacity (seconds) required before a new hold can start. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Breathing", meta = (ClampMin = "0.0", Units = "s"))
	float MinBreathToHold = 1.0f;

	/** After a forced gasp the owner is gulping air and cannot hold breath for this long. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Breathing", meta = (ClampMin = "0.0", Units = "s"))
	float GaspRecoveryDuration = 2.5f;

	// ---------------------------------------------------------------- Noise

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Noise", meta = (ClampMin = "0.0"))
	float HoldingBreathNoiseMultiplier = 0.1f;

	/** Noise multiplier at 100 panic (heavy breathing), also used while recovering from a gasp. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Noise", meta = (ClampMin = "0.0"))
	float PanickedNoiseMultiplier = 1.75f;

	/** Loudness reported to AI hearing (AActor::MakeNoise) when a gasp happens. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Noise", meta = (ClampMin = "0.0"))
	float GaspNoiseLoudness = 1.0f;

	/** Max hearing range for the gasp noise; 0 means unlimited (the listener's hearing range applies). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Noise", meta = (ClampMin = "0.0", Units = "cm"))
	float GaspNoiseRange = 1500.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Noise")
	FName GaspNoiseTag = TEXT("Gasp");

	/** Optional one-shot played on the owner when a forced gasp happens. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Noise")
	TObjectPtr<USoundBase> GaspSound;

private:
	void UpdateBreathHold(float DeltaTime);
	void RecoverBreath(float DeltaTime);
	void UpdatePanicDecay(float DeltaTime);

	/** Ends the hold without any penalty and notifies listeners. */
	void EndBreathHold();

	void TriggerForcedGasp(EForcedGaspReason Reason);
	void EmitGaspNoise() const;

	void SetPanicInternal(float NewPanic);

	UPROPERTY(VisibleInstanceOnly, Transient, Category = "Echo|State")
	float CurrentPanic = 0.0f;

	/** Remaining breath capacity in seconds. */
	UPROPERTY(VisibleInstanceOnly, Transient, Category = "Echo|State")
	float BreathRemaining = 0.0f;

	UPROPERTY(VisibleInstanceOnly, Transient, Category = "Echo|State")
	float CurrentHoldTime = 0.0f;

	UPROPERTY(VisibleInstanceOnly, Transient, Category = "Echo|State")
	float GaspRecoveryRemaining = 0.0f;

	UPROPERTY(VisibleInstanceOnly, Transient, Category = "Echo|State")
	bool bIsHoldingBreath = false;

	float TimeSincePanicIncrease = 0.0f;
};
