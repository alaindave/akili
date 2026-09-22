import { VStack, Text, Flex, Box } from "@chakra-ui/react";
import { TiDeleteOutline } from "react-icons/ti";
import Task from "../../../../common/types/task/Task";

interface Props {
  task: Task;
  onTaskDelete: (_id: string) => void;
  onTaskClick: (task: Task) => void;
}

const priorityColor = {
  HAUTE: "red.200",
  MOYENNE: "yellow.200",
  BASSE: "green.200",
} as const;

const TaskCard = ({ task, onTaskClick, onTaskDelete }: Props) => {
  return (
    <VStack
      bg={priorityColor[task.priority]}
      border="1px solid black"
      borderRadius="0.4rem"
      mb="0.4rem"
      height="6rem"
      pb={2}
      borderColor="#D1D9E0"
      boxShadow="0 2px 8px rgba(1,0,1,1)"
      width="25rem"
      cursor="pointer"
      _hover={{
        transform: "translateY(-2px)",
        shadow: "md",
      }}
    >
      <Flex justify="space-between" width="25rem">
        <Box
          fontFamily="monospace"
          fontSize="1.1rem"
          fontWeight="800"
          mt="0.4rem"
          ml="0.4rem"
          onClick={() => onTaskClick(task)}
          cursor="pointer"
        >
          {task.taskNumber}
        </Box>
        <Text mt="0.4rem">{task.author.firstName}</Text>
        <Box
          fontSize="1.2rem"
          fontWeight="800"
          mt="0.3rem"
          mr="0.5rem"
          cursor="pointer"
          onClick={() => onTaskDelete(task._id)}
        >
          <TiDeleteOutline />
        </Box>
      </Flex>

      <Flex width="25rem" justifyContent="space-between">
        <Text ml="0.4rem" color="gray.700" fontSize="1.1rem" fontWeight="500">
          {task.subject}
        </Text>
        <Text mr="1rem">
          {new Date(task.deadline).toLocaleDateString("fr-FR")}
        </Text>
      </Flex>
    </VStack>
  );
};

export default TaskCard;
