import { listen } from "@tauri-apps/api/event";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import * as api from "@/lib/tauri";
import type { MonitoringState } from "@/types";

const QUERY_KEY = ["monitoring-state"];

export function useMonitoringState() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: api.getMonitoringState,
  });

  useEffect(() => {
    const unlisten = listen<MonitoringState>("monitoring://state-changed", (event) => {
      queryClient.setQueryData(QUERY_KEY, event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [queryClient]);

  const pause = useMutation({
    mutationFn: api.pauseMonitoring,
    onSuccess: (state) => queryClient.setQueryData(QUERY_KEY, state),
  });
  const resume = useMutation({
    mutationFn: api.resumeMonitoring,
    onSuccess: (state) => queryClient.setQueryData(QUERY_KEY, state),
  });
  const toggleIncognito = useMutation({
    mutationFn: api.toggleIncognitoNext,
    onSuccess: (state) => queryClient.setQueryData(QUERY_KEY, state),
  });

  return {
    state: query.data,
    pause: (minutes?: number) => pause.mutate(minutes),
    resume: () => resume.mutate(),
    toggleIncognito: () => toggleIncognito.mutate(),
  };
}
