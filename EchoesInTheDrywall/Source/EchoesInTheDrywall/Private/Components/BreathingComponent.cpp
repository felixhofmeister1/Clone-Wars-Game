// Copyright Echoes in the Drywall. All Rights Reserved.

#include "Components/BreathingComponent.h"

#include "EchoesInTheDrywall.h"
#include "GameFramework/Actor.h"
#include "GameFramework/Pawn.h"
#include "Kismet/GameplayStatics.h"
#include "Sound/SoundBase.h"

UBreathingComponent::UBreathingComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.bStartWithTickEnabled = true;

	// Runtime state is seeded in InitializeComponent so edited defaults are respected
	// before any other actor's BeginPlay can query this component.
	bWantsInitializeComponent = true;
}

void UBreathingComponent::InitializeComponent()
{
	Super::InitializeComponent();

	CurrentPanic = FMath::Clamp(InitialPanic, 0.0f, MaxPanic);
	BreathRemaining = MaxBreathHoldDuration;
	CurrentHoldTime = 0.0f;
	GaspRecoveryRemaining = 0.0f;
	TimeSincePanicIncrease = 0.0f;
	bIsHoldingBreath = false;
}

void UBreathingComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	if (DeltaTime <= 0.0f)
	{
		return;
	}

	if (GaspRecoveryRemaining > 0.0f)
	{
		GaspRecoveryRemaining = FMath::Max(0.0f, GaspRecoveryRemaining - DeltaTime);
	}

	if (bIsHoldingBreath)
	{
		UpdateBreathHold(DeltaTime);
	}
	else
	{
		RecoverBreath(DeltaTime);
	}

	UpdatePanicDecay(DeltaTime);
}

bool UBreathingComponent::StartHoldingBreath()
{
	if (!CanHoldBreath())
	{
		UE_LOG(LogEchoes, Verbose, TEXT("%s: cannot hold breath (remaining %.2fs, gasp recovery %.2fs)."),
			*GetNameSafe(GetOwner()), BreathRemaining, GaspRecoveryRemaining);
		return false;
	}

	bIsHoldingBreath = true;
	CurrentHoldTime = 0.0f;
	OnBreathHoldChanged.Broadcast(true);
	return true;
}

void UBreathingComponent::StopHoldingBreath()
{
	if (!bIsHoldingBreath)
	{
		return;
	}

	// Terror overrides control: a panicked exhale comes out as a loud, ragged gasp.
	if (IsPanicHigh())
	{
		TriggerForcedGasp(EForcedGaspReason::PanickedRelease);
		return;
	}

	EndBreathHold();
}

void UBreathingComponent::AddPanic(float Amount)
{
	if (FMath::IsNearlyZero(Amount))
	{
		return;
	}

	if (Amount > 0.0f)
	{
		TimeSincePanicIncrease = 0.0f;
	}

	SetPanicInternal(CurrentPanic + Amount);
}

void UBreathingComponent::SetPanic(float NewPanic)
{
	if (NewPanic > CurrentPanic)
	{
		TimeSincePanicIncrease = 0.0f;
	}

	SetPanicInternal(NewPanic);
}

bool UBreathingComponent::CanHoldBreath() const
{
	return IsActive()
		&& !bIsHoldingBreath
		&& GaspRecoveryRemaining <= 0.0f
		&& BreathRemaining >= FMath::Min(MinBreathToHold, MaxBreathHoldDuration);
}

float UBreathingComponent::GetBreathRemainingNormalized() const
{
	return MaxBreathHoldDuration > 0.0f
		? FMath::Clamp(BreathRemaining / MaxBreathHoldDuration, 0.0f, 1.0f)
		: 0.0f;
}

float UBreathingComponent::GetNoiseMultiplier() const
{
	if (bIsHoldingBreath)
	{
		return HoldingBreathNoiseMultiplier;
	}

	const float PanicNoise = FMath::Lerp(1.0f, PanickedNoiseMultiplier, GetPanicNormalized());
	return IsRecoveringFromGasp() ? FMath::Max(PanicNoise, PanickedNoiseMultiplier) : PanicNoise;
}

void UBreathingComponent::UpdateBreathHold(float DeltaTime)
{
	CurrentHoldTime += DeltaTime;

	// Fear burns oxygen: the same breath lasts less time the more panicked the owner is.
	const float DrainRate = 1.0f + GetPanicNormalized() * PanicBreathDrainMultiplier;
	BreathRemaining = FMath::Max(0.0f, BreathRemaining - DeltaTime * DrainRate);

	if (PanicGainWhileHoldingBreath > 0.0f)
	{
		AddPanic(PanicGainWhileHoldingBreath * DeltaTime);
	}

	// A panic listener may have ended the hold (e.g. by calling StopHoldingBreath).
	if (bIsHoldingBreath && BreathRemaining <= 0.0f)
	{
		TriggerForcedGasp(EForcedGaspReason::BreathExhausted);
	}
}

void UBreathingComponent::RecoverBreath(float DeltaTime)
{
	if (BreathRemaining < MaxBreathHoldDuration)
	{
		BreathRemaining = FMath::Min(MaxBreathHoldDuration, BreathRemaining + DeltaTime * BreathRecoveryRate);
	}
}

void UBreathingComponent::UpdatePanicDecay(float DeltaTime)
{
	// No calming down while the owner is still fighting for air.
	if (bIsHoldingBreath)
	{
		return;
	}

	TimeSincePanicIncrease += DeltaTime;
	if (TimeSincePanicIncrease < PanicDecayDelay || PanicDecayRate <= 0.0f)
	{
		return;
	}

	const float Floor = FMath::Clamp(PanicFloor, 0.0f, MaxPanic);
	if (CurrentPanic > Floor)
	{
		SetPanicInternal(FMath::Max(Floor, CurrentPanic - PanicDecayRate * DeltaTime));
	}
}

void UBreathingComponent::EndBreathHold()
{
	if (!bIsHoldingBreath)
	{
		return;
	}

	bIsHoldingBreath = false;
	CurrentHoldTime = 0.0f;
	OnBreathHoldChanged.Broadcast(false);
}

void UBreathingComponent::TriggerForcedGasp(EForcedGaspReason Reason)
{
	// Lock out new holds *before* notifying anyone, so a listener cannot re-enter a hold mid-gasp.
	GaspRecoveryRemaining = GaspRecoveryDuration;
	EndBreathHold();

	AddPanic(ForcedGaspPanicSpike);
	EmitGaspNoise();

	UE_LOG(LogEchoes, Log, TEXT("%s: forced gasp (%s), panic now %.1f."), *GetNameSafe(GetOwner()),
		Reason == EForcedGaspReason::BreathExhausted ? TEXT("breath exhausted") : TEXT("panicked release"), CurrentPanic);

	OnForcedGasp.Broadcast(Reason, CurrentPanic);
}

void UBreathingComponent::EmitGaspNoise() const
{
	AActor* Owner = GetOwner();
	if (!Owner)
	{
		return;
	}

	if (GaspSound)
	{
		if (USceneComponent* AttachTo = Owner->GetRootComponent())
		{
			UGameplayStatics::SpawnSoundAttached(GaspSound, AttachTo);
		}
		else
		{
			UGameplayStatics::PlaySoundAtLocation(this, GaspSound, Owner->GetActorLocation());
		}
	}

	// Routed to AI Perception hearing (or a PawnNoiseEmitterComponent) when either is in use.
	if (GaspNoiseLoudness > 0.0f)
	{
		APawn* Instigator = Cast<APawn>(Owner);
		if (!Instigator)
		{
			Instigator = Owner->GetInstigator();
		}

		if (Instigator)
		{
			Owner->MakeNoise(GaspNoiseLoudness, Instigator, Owner->GetActorLocation(), GaspNoiseRange, GaspNoiseTag);
		}
	}
}

void UBreathingComponent::SetPanicInternal(float NewPanic)
{
	const float Clamped = FMath::Clamp(NewPanic, 0.0f, MaxPanic);
	if (FMath::IsNearlyEqual(Clamped, CurrentPanic))
	{
		return;
	}

	const float Previous = CurrentPanic;
	CurrentPanic = Clamped;
	OnPanicChanged.Broadcast(CurrentPanic, Previous);
}
