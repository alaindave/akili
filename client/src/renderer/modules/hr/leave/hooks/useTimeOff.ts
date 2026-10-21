import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TimeOffMotif } from "../../../../../common/types/hr/time-off/TimeOff";

export const timeOffKeys = {
  all: (companyId: string) => ["time-off", companyId] as const,
  list: (companyId: string, employeeId?: string) => ["time-off", companyId, "list", employeeId ?? "all"] as const,
  motifs: (companyId: string) => ["time-off", companyId, "motifs"] as const,
};

export function useTimeOffList(companyId: string, employeeId?: string) {
  return useQuery({ queryKey: timeOffKeys.list(companyId, employeeId), queryFn: () => window.electron.hr.timeOff.list(companyId, employeeId), enabled: Boolean(companyId) });
}
export function useTimeOffMotifs(companyId: string) {
  return useQuery({ queryKey: timeOffKeys.motifs(companyId), queryFn: () => window.electron.hr.timeOff.motifs.list(companyId), enabled: Boolean(companyId) });
}
export function useCreateTimeOff(companyId: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: Parameters<typeof window.electron.hr.timeOff.create>[1]) => window.electron.hr.timeOff.create(companyId, input), onSuccess: () => client.invalidateQueries({ queryKey: timeOffKeys.all(companyId) }) });
}
export function useTransitionTimeOff(companyId: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, action, reason }: { id: string; action: "approve" | "reject" | "cancel" | "delete"; reason?: string }) => window.electron.hr.timeOff.transition(companyId, id, action, reason), onSuccess: () => client.invalidateQueries({ queryKey: timeOffKeys.all(companyId) }) });
}
export function useReviewLegacyTimeOff(companyId: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, motifId, notes }: { id: string; motifId: string; notes?: string }) => window.electron.hr.timeOff.reviewLegacy(companyId, id, motifId, notes), onSuccess: () => client.invalidateQueries({ queryKey: timeOffKeys.all(companyId) }) });
}
export function useSaveTimeOffMotif(companyId: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (motif: Omit<TimeOffMotif, "companyId"> & { companyId?: string }) => window.electron.hr.timeOff.motifs.save(companyId, motif), onSuccess: () => client.invalidateQueries({ queryKey: timeOffKeys.motifs(companyId) }) });
}
