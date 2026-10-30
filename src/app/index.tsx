/**
 * PawCare AI — Root Entry Point
 *
 * Redirects to /(app) if authenticated, or /(auth)/welcome if not.
 */
import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/presentation/stores/useAuthStore';

export default function Index() {
  const { user } = useAuthStore();

  if (user) {
    return <Redirect href={"/(app)" as any} />;
  }

  return <Redirect href={"/(auth)/welcome" as any} />;
}
