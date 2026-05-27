import React from "react";
import { Tabs } from "expo-router";
import { Colors } from "../../lib/colors";

export default function ReportLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          paddingBottom: 4,
          height: 56,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="drugs"
        options={{ title: "Drugs", tabBarIcon: () => null, tabBarLabel: "💊 Drugs" }}
      />
      <Tabs.Screen
        name="risk"
        options={{ title: "Risk", tabBarIcon: () => null, tabBarLabel: "📊 Risk" }}
      />
      <Tabs.Screen
        name="carrier"
        options={{ title: "Carrier", tabBarIcon: () => null, tabBarLabel: "🧬 Carrier" }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{ title: "Nutrition", tabBarIcon: () => null, tabBarLabel: "🥗 Nutrition" }}
      />
      <Tabs.Screen
        name="scan"
        options={{ title: "Scan", tabBarIcon: () => null, tabBarLabel: "📷 Scan" }}
      />
    </Tabs>
  );
}
