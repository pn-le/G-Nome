import React, { useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PaperProvider } from "react-native-paper";
import { ReportContext, type ReportData } from "../lib/context";
import { Colors } from "../lib/colors";

export default function RootLayout() {
  const [report, setReport] = useState<ReportData | null>(null);

  return (
    <PaperProvider>
      <ReportContext.Provider value={{ report, setReport }}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: Colors.background },
            headerTintColor: Colors.textPrimary,
            headerTitleStyle: { fontWeight: "700" },
            contentStyle: { backgroundColor: Colors.background },
          }}
        >
          <Stack.Screen
            name="index"
            options={{ title: "G-Nome", headerShown: false }}
          />
          <Stack.Screen
            name="report"
            options={{ title: "Your Report", headerBackTitle: "Back" }}
          />
        </Stack>
      </ReportContext.Provider>
    </PaperProvider>
  );
}
