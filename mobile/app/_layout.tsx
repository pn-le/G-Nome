import React, { useEffect, useState } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PaperProvider } from "react-native-paper";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { ReportContext, type ReportData } from "../lib/context";
import { Colors } from "../lib/colors";

export default function RootLayout() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session && ready) router.replace("/auth");
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!ready) return null;

  return (
    <PaperProvider>
      <ReportContext.Provider value={{ report, setReport }}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: Colors.background },
            headerTintColor: Colors.textPrimary,
            headerTitleStyle: { fontWeight: "700" },
            contentStyle: { backgroundColor: Colors.background },
          }}
        >
          <Stack.Screen
            name="auth"
            options={{ title: "Sign In", headerShown: false }}
          />
          <Stack.Screen
            name="index"
            options={{ title: "G-Nome", headerShown: false }}
          />
          <Stack.Screen
            name="report"
            options={{ title: "Your Report", headerBackTitle: "Back" }}
          />
          <Stack.Screen
            name="profile"
            options={{
              title: "Mii Studio",
              headerBackTitle: "Back",
              headerStyle: { backgroundColor: "#0B1020" },
              headerTintColor: "#FFFFFF",
            }}
          />
        </Stack>
      </ReportContext.Provider>
    </PaperProvider>
  );
}
