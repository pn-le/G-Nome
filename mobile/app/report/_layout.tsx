import React from "react";
import { Tabs } from "expo-router";
import { Colors } from "../../lib/colors";
import { Pill, Activity, Dna, Apple, Camera } from "lucide-react-native";

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
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginBottom: 4 },
      }}
    >
      <Tabs.Screen
        name="drugs"
        options={{ 
          title: "Drugs", 
          tabBarIcon: ({ color, size }) => <Pill color={color} size={size} />, 
          tabBarLabel: "Drugs" 
        }}
      />
      <Tabs.Screen
        name="risk"
        options={{ 
          title: "Risk", 
          tabBarIcon: ({ color, size }) => <Activity color={color} size={size} />, 
          tabBarLabel: "Risk" 
        }}
      />
      <Tabs.Screen
        name="carrier"
        options={{ 
          title: "Carrier", 
          tabBarIcon: ({ color, size }) => <Dna color={color} size={size} />, 
          tabBarLabel: "Carrier" 
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{ 
          title: "Nutrition", 
          tabBarIcon: ({ color, size }) => <Apple color={color} size={size} />, 
          tabBarLabel: "Nutrition" 
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{ 
          title: "Scan", 
          tabBarIcon: ({ color, size }) => <Camera color={color} size={size} />, 
          tabBarLabel: "Scan" 
        }}
      />
    </Tabs>
  );
}
