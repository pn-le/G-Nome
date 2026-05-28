import React, { useState, useCallback } from "react";
import { ScrollView, Alert, StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors } from "./colors";
import type { AvatarGenerationState } from "./types";
import { SpotlightAvatar } from "./SpotlightAvatar";
import { SelfieUploadCard } from "./SelfieUploadCard";
import { GenerationProgress } from "./GenerationProgress";
import { AvatarActionBar } from "./AvatarActionBar";
import { generateMiiAvatar, saveAvatarToProfile } from "./api";

export function MiiProfileStudio() {
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [generatedUri, setGeneratedUri] = useState<string | null>(null);
  const [state, setState] = useState<AvatarGenerationState>("idle");

  const pickImage = useCallback(async (useCamera: boolean) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission needed", "Please grant access to continue.");
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });

    if (!result.canceled && result.assets[0]) {
      setSelfieUri(result.assets[0].uri);
      setGeneratedUri(null);
      setState("selfie_uploaded");
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selfieUri) return;
    setState("generating");
    try {
      const uri = await generateMiiAvatar(selfieUri);
      setGeneratedUri(uri);
      setState("generated");
    } catch {
      setState("error");
    }
  }, [selfieUri]);

  const handleSave = useCallback(async () => {
    if (!generatedUri) return;
    try {
      await saveAvatarToProfile(generatedUri);
      Alert.alert("Saved", "Your avatar has been saved to your profile.");
    } catch {
      Alert.alert("Error", "Failed to save avatar. Please try again.");
    }
  }, [generatedUri]);

  const handleRegenerate = useCallback(() => {
    setGeneratedUri(null);
    setState("selfie_uploaded");
  }, []);

  const isGenerating = state === "generating";
  const isDisabled = isGenerating;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      bounces={false}
    >
      <SpotlightAvatar
        generatedUri={generatedUri}
        isGenerating={isGenerating}
      />

      <SelfieUploadCard
        selfieUri={selfieUri}
        onTakeSelfie={() => pickImage(true)}
        onUploadPhoto={() => pickImage(false)}
        onChangePhoto={() => pickImage(false)}
        disabled={isDisabled}
      />

      <GenerationProgress visible={isGenerating} />

      <AvatarActionBar
        state={state}
        onGenerate={handleGenerate}
        onSave={handleSave}
        onRegenerate={handleRegenerate}
        onRetry={handleGenerate}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 40,
  },
});
