export type AvatarGenerationState =
  | "idle"
  | "selfie_uploaded"
  | "generating"
  | "generated"
  | "error";

export type GenerationStep = {
  label: string;
  completed: boolean;
};

export type AvatarProfile = {
  avatarUri: string;
  thumbnailUri: string;
  savedAt?: string;
};
