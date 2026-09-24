// Copyright Echoes in the Drywall. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
// Full include (not a forward declaration): EAudioFaderCurve is used as a UPROPERTY type below.
#include "Components/AudioComponent.h"
#include "GameFramework/Actor.h"
#include "HorrorAudioManager.generated.h"

class USoundAttenuation;
class USoundBase;
class USoundConcurrency;
class USoundMix;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnBehindPlayerEventSignature, USoundBase*, Sound, FVector, SoundLocation);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnSilenceEndedSignature);

/**
 * Level-wide horror soundscape director.
 *
 * Plays a continuous low-frequency drone and, on a looping timer, stages a "something is behind you"
 * beat: a spatialized sound spawned 3.5 m directly behind the player while the drone drops to
 * absolute silence for 4.5 s before swelling back. Place one per level.
 */
UCLASS(Blueprintable)
class ECHOESINTHEDRYWALL_API AHorrorAudioManager : public AActor
{
	GENERATED_BODY()

public:
	AHorrorAudioManager();

	/** (Re)starts the looping behind-the-player timer. */
	UFUNCTION(BlueprintCallable, Category = "Echo|Audio")
	void StartBehindPlayerEvents();

	/** Stops scheduling new events. A silence already in progress still recovers normally. */
	UFUNCTION(BlueprintCallable, Category = "Echo|Audio")
	void StopBehindPlayerEvents();

	/** Stages the event immediately, ignoring EventChance. Returns false if it could not play. */
	UFUNCTION(BlueprintCallable, Category = "Echo|Audio")
	bool TriggerBehindPlayerEventNow();

	UFUNCTION(BlueprintPure, Category = "Echo|Audio")
	bool IsSilenceActive() const { return bSilenceActive; }

	UFUNCTION(BlueprintPure, Category = "Echo|Audio")
	bool AreBehindPlayerEventsRunning() const;

	/** Fired when the sound is spawned behind the player (the silence starts at the same moment). */
	UPROPERTY(BlueprintAssignable, Category = "Echo|Audio")
	FOnBehindPlayerEventSignature OnBehindPlayerEvent;

	/** Fired once the drone has fully faded back in. */
	UPROPERTY(BlueprintAssignable, Category = "Echo|Audio")
	FOnSilenceEndedSignature OnSilenceEnded;

protected:
	//~ Begin AActor Interface
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
	//~ End AActor Interface

	/** Non-spatialized drone bed. Its level is driven through AdjustVolume so the loop never restarts. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
	TObjectPtr<UAudioComponent> AmbientDroneAudio;

	// ---------------------------------------------------------------- Drone

	/** Low-frequency loop. The asset itself must loop (looping wave, cue, or MetaSound). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Audio|Drone")
	TObjectPtr<USoundBase> AmbientDroneSound;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Audio|Drone", meta = (ClampMin = "0.0", ClampMax = "4.0"))
	float DroneVolume = 1.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Audio|Drone")
	bool bStartDroneOnBeginPlay = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Audio|Drone", meta = (ClampMin = "0.0", Units = "s"))
	float DroneStartFadeInTime = 4.0f;

	// ---------------------------------------------------------------- Behind-the-player event

	/** One-shot candidates (whispers, knocks, a breath). One is picked at random, avoiding repeats. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Audio|Behind Player")
	TArray<TObjectPtr<USoundBase>> BehindPlayerSounds;

	/**
	 * Spatialization for the event sound. Leave empty only if every sound carries its own attenuation;
	 * without either the sound plays non-spatialized and the "behind you" illusion is lost.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Audio|Behind Player")
	TObjectPtr<USoundAttenuation> BehindPlayerAttenuation;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Audio|Behind Player")
	TObjectPtr<USoundConcurrency> BehindPlayerConcurrency;

	/** Distance behind the player's actor transform (350 cm = 3.5 m). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Audio|Behind Player", meta = (ClampMin = "0.0", Units = "cm"))
	float BehindPlayerDistance = 350.0f;

	/** Vertical offset from the actor origin (capsule centre); raise it to place sounds at head height. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Audio|Behind Player", meta = (Units = "cm"))
	float BehindPlayerHeightOffset = 0.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Audio|Behind Player", meta = (ClampMin = "0.0", ClampMax = "4.0"))
	float BehindSoundVolume = 1.0f;

	/** Random pitch spread (+/-) so repeated sounds do not become familiar. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Audio|Behind Player", meta = (ClampMin = "0.0", ClampMax = "0.5"))
	float BehindSoundPitchVariance = 0.05f;

	// ---------------------------------------------------------------- Scheduling

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Audio|Scheduling")
	bool bAutoStartEvents = true;

	/** Delay before the first event after the loop starts. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Audio|Scheduling", meta = (ClampMin = "0.0", Units = "s"))
	float FirstEventDelay = 20.0f;

	/** Base period of the looping timer. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Audio|Scheduling", meta = (ClampMin = "1.0", Units = "s"))
	float EventInterval = 30.0f;

	/** Each period is re-rolled within +/- this, so the rhythm never becomes predictable. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Audio|Scheduling", meta = (ClampMin = "0.0", Units = "s"))
	float EventIntervalJitter = 10.0f;

	/** Probability that a timer tick actually stages the event. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Audio|Scheduling", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float EventChance = 0.75f;

	// ---------------------------------------------------------------- Silence window

	/** How long the drone stays at 0.0 once it has faded out. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Audio|Silence", meta = (ClampMin = "0.0", Units = "s"))
	float SilenceDuration = 4.5f;

	/** Near-instant cut: the world "holds its breath". */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Audio|Silence", meta = (ClampMin = "0.0", Units = "s"))
	float SilenceFadeOutTime = 0.25f;

	/** Slow swell back to DroneVolume after the silence. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Audio|Silence", meta = (ClampMin = "0.0", Units = "s"))
	float SilenceFadeInTime = 3.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Audio|Silence")
	EAudioFaderCurve SilenceFadeCurve = EAudioFaderCurve::Logarithmic;

	/** Optional sound mix pushed for the silence window (e.g. ducking other ambience classes). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Audio|Silence")
	TObjectPtr<USoundMix> SilenceSoundMix;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Debug")
	bool bDrawDebug = false;

private:
	/** Looping timer callback: re-rolls the next period, then rolls EventChance. */
	void HandleBehindPlayerTimer();

	bool PlayBehindPlayerEvent();

	void BeginSilence();
	void EndSilence();
	void FinishSilenceRecovery();

	void StartDrone();
	bool IsDronePlaying() const;

	/** 3.5 m (BehindPlayerDistance) directly behind Target, using its actor transform's heading. */
	bool ComputeBehindLocation(const AActor& Target, FVector& OutLocation) const;

	float ComputeNextInterval() const;
	USoundBase* PickBehindPlayerSound();
	void ValidateSetup() const;

	void PushSilenceMix();
	void PopSilenceMix();

	FTimerHandle BehindPlayerTimerHandle;
	FTimerHandle SilenceTimerHandle;

	/** The mix actually pushed, so the matching one is popped even if SilenceSoundMix changes meanwhile. */
	UPROPERTY(Transient)
	TObjectPtr<USoundMix> PushedSilenceMix;

	bool bSilenceActive = false;
	bool bDroneWasPlayingBeforeSilence = false;
	int32 LastSoundIndex = INDEX_NONE;
};
