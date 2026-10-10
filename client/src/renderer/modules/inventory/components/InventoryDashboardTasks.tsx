import { useEffect, useState } from "react";
import {
  Box,
  Button,
  HStack,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import type Task from "../../../../common/types/task/Task";
import TaskCard from "../../../components/tasks/TaskCard";
import useDashboardTasksStore, { dashboardTaskScope } from "../../../../store/dashboardTasks.store";

export default function InventoryDashboardTasks({
  companyId,
  userId,
  version,
  onEmptyChange,
}: {
  companyId: string;
  userId: string;
  version: string;
  onEmptyChange: (empty: boolean) => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const navigate = useNavigate();
  const scope = dashboardTaskScope(companyId, userId, "INVENTORY");
  const dismissed = useDashboardTasksStore(store => store.dismissed[scope]);
  const dismiss = useDashboardTasksStore(store => store.dismiss);
  const visibleTasks = tasks.filter(task => !dismissed?.includes(task._id));

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    window.electron.tasks.tasks
      .getTopTasks(companyId, userId, "INVENTORY")
      .then((rows: Task[]) => {
        if (active)
          setTasks(
            rows.filter(
              (task) =>
                task.companyId === companyId &&
                task.module === "INVENTORY" &&
                !task.isResolved &&
                !task.isDeleted
            )
          );
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, userId, version, retry]);

  const empty = !loading && !error && visibleTasks.length === 0;
  useEffect(() => {
    onEmptyChange(empty);
  }, [empty, onEmptyChange]);

  if (empty) return null;

  return (
    <Box minW={0} minH={0} h="100%" display="flex" flexDir="column" overflow="hidden">
      {loading ? (
        <HStack role="status" p={4}>
          <Spinner size="sm" />
          <Text>Chargement des tâches…</Text>
        </HStack>
      ) : error ? (
        <Box p={4}>
          <Text role="alert">Impossible de charger les tâches.</Text>
          <Button
            size="sm"
            mt={2}
            onClick={() => setRetry((value) => value + 1)}
          >
            Réessayer
          </Button>
        </Box>
      ) : (
        <VStack align="stretch" spacing={3} flex="1" minH={0} overflowY="auto" p={2}>
          {visibleTasks.map((task) => (
            <Box key={task._id} flexShrink={0}>
              <TaskCard
                task={task}
                onTaskClick={(selected) =>
                  navigate(`/inventory/tasks/details/${selected._id}`)
                }
                onTaskDelete={(id) =>
                  dismiss(scope, id)
                }
              />
            </Box>
          ))}
        </VStack>
      )}
    </Box>
  );
}
