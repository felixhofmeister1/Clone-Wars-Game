// Copyright Echoes in the Drywall. All Rights Reserved.

#include "Audio/HorrorAudioManager.h"

#include "Components/AudioComponent.h"
#include "DrawDebugHelpers.h"
#include "EchoesInTheDrywall.h"
#include "Engine/World.h"
#include "GameFramework/Pawn.h"
#include "Kismet/GameplayStatics.h"
#include "Sound/SoundAttenuation.h"
#include "Sound/SoundBase.h"
#include "Sound/SoundConcurrency.h"
#include "Sound/SoundMix.h"
#include "TimerManager.h"

namespace EchoAudio
{
	/** Floor for re-rolled timer periods, so heavy jitter can never produce a zero or negative rate. */
	constexpr float MinEventInterval = 1.0f;
}

AHorrorAudioManager::AHorrorAudioManager()
{
	// Entirely timer-driven.
	PrimaryActorTick.bCanEverTick = false;

	AmbientDroneAudio = CreateDefaultSubobject<UAudioComponent>(TEXT("AmbientDroneAudio"));
	RootComponent = AmbientDroneAudio;
	AmbientDroneAudio->bAutoActivate = false;        // Started with a fade in BeginPlay.
	AmbientDroneAudio->bAllowSpatialization = false; // A bed around the listener, not a point source.
	AmbientDroneAudio->bIsUISound = false;           // Pauses with the game.
}

void AHorrorAudioManager::BeginPlay()
{
	Super::BeginPlay();

	ValidateSetup();

	if (bStartDroneOnBeginPlay)
	{
		StartDrone();
	}

	if (bAutoStartEvents)
	{
		StartBehindPlayerEvents();
	}
}

void AHorrorAudioManager::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (UWorld* World = GetWorld())
	{
		World->GetTimerManager().ClearAllTimersForObject(this);
	}
	BehindPlayerTimerHandle.Invalidate();
	SilenceTimerHandle.Invalidate();

	// Never leave a ducking mix applied for whatever loads next.
	PopSilenceMix();
	bSilenceActive = false;

	if (AmbientDroneAudio)
	{
		AmbientDroneAudio->Stop();
	}

	Super::EndPlay(EndPlayReason);
}

void AHorrorAudioManager::StartBehindPlayerEvents()
{
	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}

	// Looping timer; HandleBehindPlayerTimer re-rolls the period every cycle.
	World->GetTimerManager().SetTimer(BehindPlayerTimerHandle, this, &ThisClass::HandleBehindPlayerTimer,
		ComputeNextInterval(), /*bLoop=*/ true, FirstEventDelay);
}

void AHorrorAudioManager::StopBehindPlayerEvents()
{
	if (UWorld* World = GetWorld())
	{
		World->GetTimerManager().ClearTimer(BehindPlayerTimerHandle);
	}
}

bool AHorrorAudioManager::TriggerBehindPlayerEventNow()
{
	return PlayBehindPlayerEvent();
}

bool AHorrorAudioManager::AreBehindPlayerEventsRunning() const
{
	const UWorld* World = GetWorld();
	return World && World->GetTimerManager().IsTimerActive(BehindPlayerTimerHandle);
}

void AHorrorAudioManager::HandleBehindPlayerTimer()
{
	// Re-arm the same looping handle with a fresh period so the scares never fall into a rhythm.
	// FTimerManager supports re-setting a timer from inside its own callback.
	if (EventIntervalJitter > 0.0f)
	{
		if (UWorld* World = GetWorld())
		{
			World->GetTimerManager().SetTimer(BehindPlayerTimerHandle, this, &ThisClass::HandleBehindPlayerTimer,
				ComputeNextInterval(), /*bLoop=*/ true);
		}
	}

	// Never stack events: the previous silence is still playing out.
	if (bSilenceActive)
	{
		return;
	}

	if (FMath::FRand() >= EventChance)
	{
		return;
	}

	PlayBehindPlayerEvent();
}

bool AHorrorAudioManager::PlayBehindPlayerEvent()
{
	if (bSilenceActive)
	{
		UE_LOG(LogEchoes, Verbose, TEXT("%s: behind-player event skipped; a silence is already active."), *GetName());
		return false;
	}

	const APawn* PlayerPawn = UGameplayStatics::GetPlayerPawn(this, 0);
	if (!PlayerPawn)
	{
		UE_LOG(LogEchoes, Verbose, TEXT("%s: behind-player event skipped; no player pawn."), *GetName());
		return false;
	}

	FVector SoundLocation = FVector::ZeroVector;
	if (!ComputeBehindLocation(*PlayerPawn, SoundLocation))
	{
		return false;
	}

	USoundBase* Sound = PickBehindPlayerSound();
	if (!Sound)
	{
		UE_LOG(LogEchoes, Warning, TEXT("%s: BehindPlayerSounds has no valid entry; event skipped."), *GetName());
		return false;
	}

	const float Pitch = 1.0f + FMath::FRandRange(-BehindSoundPitchVariance, BehindSoundPitchVariance);

	// Face the emitter at the player, which matters for directional (focus) attenuation settings.
	const FRotator FacingPlayer = (PlayerPawn->GetActorLocation() - SoundLocation).Rotation();

	UGameplayStatics::PlaySoundAtLocation(this, Sound, SoundLocation, FacingPlayer, BehindSoundVolume, Pitch,
		/*StartTime=*/ 0.0f, BehindPlayerAttenuation, BehindPlayerConcurrency, /*OwningActor=*/ this);

	BeginSilence();

#if ENABLE_DRAW_DEBUG
	if (bDrawDebug)
	{
		if (const UWorld* World = GetWorld())
		{
			const float DebugLifetime = SilenceFadeOutTime + SilenceDuration;
			DrawDebugSphere(World, SoundLocation, 25.0f, 12, FColor::Purple, false, DebugLifetime);
			DrawDebugLine(World, PlayerPawn->GetActorLocation(), SoundLocation, FColor::Purple, false, DebugLifetime);
		}
	}
#endif

	UE_LOG(LogEchoes, Log, TEXT("%s: played %s %.0f cm behind %s."), *GetName(), *GetNameSafe(Sound),
		BehindPlayerDistance, *GetNameSafe(PlayerPawn));

	OnBehindPlayerEvent.Broadcast(Sound, SoundLocation);
	return true;
}

void AHorrorAudioManager::BeginSilence()
{
	bSilenceActive = true;
	bDroneWasPlayingBeforeSilence = IsDronePlaying();

	if (bDroneWasPlayingBeforeSilence)
	{
		// AdjustVolume rather than FadeOut: FadeOut would stop the component, AdjustVolume keeps the
		// loop running at 0.0 so it can swell back without restarting.
		AmbientDroneAudio->AdjustVolume(SilenceFadeOutTime, 0.0f, SilenceFadeCurve);
	}

	PushSilenceMix();

	// SetTimer treats a rate <= 0 as "clear", so zero-length windows must be run directly.
	const float SilentFor = SilenceFadeOutTime + SilenceDuration;
	UWorld* World = GetWorld();
	if (World && SilentFor > 0.0f)
	{
		World->GetTimerManager().SetTimer(SilenceTimerHandle, this, &ThisClass::EndSilence, SilentFor, /*bLoop=*/ false);
	}
	else
	{
		EndSilence();
	}
}

void AHorrorAudioManager::EndSilence()
{
	PopSilenceMix();

	if (AmbientDroneAudio && bDroneWasPlayingBeforeSilence)
	{
		if (IsDronePlaying())
		{
			AmbientDroneAudio->AdjustVolume(SilenceFadeInTime, DroneVolume, SilenceFadeCurve);
		}
		else
		{
			// The voice was stopped while silent (e.g. a non-looping asset ran out); bring it back.
			AmbientDroneAudio->FadeIn(SilenceFadeInTime, DroneVolume, 0.0f, SilenceFadeCurve);
		}
	}

	UWorld* World = GetWorld();
	if (World && SilenceFadeInTime > 0.0f)
	{
		World->GetTimerManager().SetTimer(SilenceTimerHandle, this, &ThisClass::FinishSilenceRecovery, SilenceFadeInTime, /*bLoop=*/ false);
	}
	else
	{
		FinishSilenceRecovery();
	}
}

void AHorrorAudioManager::FinishSilenceRecovery()
{
	bSilenceActive = false;
	OnSilenceEnded.Broadcast();
}

void AHorrorAudioManager::StartDrone()
{
	if (!AmbientDroneAudio)
	{
		UE_LOG(LogEchoes, Error, TEXT("%s: AmbientDroneAudio component is missing; drone disabled."), *GetName());
		return;
	}

	if (AmbientDroneSound)
	{
		AmbientDroneAudio->SetSound(AmbientDroneSound);
	}

	if (!AmbientDroneAudio->Sound)
	{
		UE_LOG(LogEchoes, Warning, TEXT("%s: no AmbientDroneSound assigned; drone disabled."), *GetName());
		return;
	}

	AmbientDroneAudio->FadeIn(DroneStartFadeInTime, DroneVolume, 0.0f, EAudioFaderCurve::Linear);
}

bool AHorrorAudioManager::IsDronePlaying() const
{
	return AmbientDroneAudio && AmbientDroneAudio->IsPlaying();
}

bool AHorrorAudioManager::ComputeBehindLocation(const AActor& Target, FVector& OutLocation) const
{
	const FTransform& TargetTransform = Target.GetActorTransform();

	// Heading only: flattened so a pitched or rolled actor never buries the sound in the floor or ceiling.
	FVector Forward = TargetTransform.GetRotation().GetForwardVector();
	Forward.Z = 0.0f;
	if (!Forward.Normalize())
	{
		return false;
	}

	OutLocation = TargetTransform.GetLocation()
		- Forward * BehindPlayerDistance
		+ FVector(0.0f, 0.0f, BehindPlayerHeightOffset);
	return true;
}

float AHorrorAudioManager::ComputeNextInterval() const
{
	const float Jitter = FMath::Max(0.0f, EventIntervalJitter);
	return FMath::Max(EchoAudio::MinEventInterval, EventInterval + FMath::FRandRange(-Jitter, Jitter));
}

USoundBase* AHorrorAudioManager::PickBehindPlayerSound()
{
	TArray<int32, TInlineAllocator<16>> Candidates;
	for (int32 Index = 0; Index < BehindPlayerSounds.Num(); ++Index)
	{
		if (BehindPlayerSounds[Index] && Index != LastSoundIndex)
		{
			Candidates.Add(Index);
		}
	}

	// Only the previous sound is usable: allow the repeat rather than skipping the scare.
	if (Candidates.IsEmpty() && BehindPlayerSounds.IsValidIndex(LastSoundIndex) && BehindPlayerSounds[LastSoundIndex])
	{
		Candidates.Add(LastSoundIndex);
	}

	if (Candidates.IsEmpty())
	{
		return nullptr;
	}

	LastSoundIndex = Candidates[FMath::RandRange(0, Candidates.Num() - 1)];
	return BehindPlayerSounds[LastSoundIndex];
}

void AHorrorAudioManager::ValidateSetup() const
{
	USoundBase* DroneSound = AmbientDroneSound
		? AmbientDroneSound.Get()
		: (AmbientDroneAudio ? AmbientDroneAudio->Sound.Get() : nullptr);

	if (DroneSound && !DroneSound->IsLooping())
	{
		UE_LOG(LogEchoes, Warning, TEXT("%s: drone sound %s does not loop; it will stop and be restarted after silences."),
			*GetName(), *DroneSound->GetName());
	}

	if (BehindPlayerSounds.IsEmpty())
	{
		UE_LOG(LogEchoes, Warning, TEXT("%s: BehindPlayerSounds is empty; behind-player events will be skipped."), *GetName());
	}

	for (const TObjectPtr<USoundBase>& Sound : BehindPlayerSounds)
	{
		if (!Sound)
		{
			continue;
		}

		if (Sound->IsLooping())
		{
			UE_LOG(LogEchoes, Warning, TEXT("%s: %s loops; PlaySoundAtLocation only plays one-shots, use a non-looping asset."),
				*GetName(), *Sound->GetName());
		}

		if (!BehindPlayerAttenuation && !Sound->GetAttenuationSettingsToApply())
		{
			UE_LOG(LogEchoes, Warning, TEXT("%s: %s has no attenuation and BehindPlayerAttenuation is empty; it will play non-spatialized."),
				*GetName(), *Sound->GetName());
		}
	}
}

void AHorrorAudioManager::PushSilenceMix()
{
	if (!SilenceSoundMix || PushedSilenceMix)
	{
		return;
	}

	UGameplayStatics::PushSoundMixModifier(this, SilenceSoundMix);
	PushedSilenceMix = SilenceSoundMix;
}

void AHorrorAudioManager::PopSilenceMix()
{
	if (!PushedSilenceMix)
	{
		return;
	}

	UGameplayStatics::PopSoundMixModifier(this, PushedSilenceMix);
	PushedSilenceMix = nullptr;
}
