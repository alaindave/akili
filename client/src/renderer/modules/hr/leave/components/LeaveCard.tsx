import {
  Image,
  Box,
  Grid,
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";

import useAdminUser from "../../../../../store/auth.store";

import { IoIosCheckmarkCircleOutline } from "react-icons/io";
import { MdOutlineDeleteForever } from "react-icons/md";
import { PiDotsThreeOutlineVerticalDuotone } from "react-icons/pi";
import { TiDeleteOutline } from "react-icons/ti";
import { FaRegEdit } from "react-icons/fa";

import LeaveNotesPopover from "./LeaveNotesPopover";
import LeaveEdit from "./LeaveEdit";

import type { LeaveWithEmployee } from "../../../../../common/types/leave/LeaveWithEmployee";

import defaultAvatar from "../../../../assets/default-avatar.jpeg";
import DeletionDialog from "../../../../components/DeletionDialog";

import { useCancelLeave, useUpdateLeave } from "../hooks/useLeave";

import {
  useEmployee,
  useUpdateEmployee,
} from "../../employees/hooks/useEmployees";

/* =========================================================
   TYPES
========================================================= */

interface Props {
  leave: LeaveWithEmployee;
  onDelete: () => void;
  gridTemplate: string;
}

/* =========================================================
   COMPONENT
========================================================= */

const EmployeeLeaveCard = ({ leave, onDelete, gridTemplate }: Props) => {
  const toast = useToast();

  const { isOpen, onOpen, onClose } = useDisclosure();

  const {
    isOpen: isCancelOpen,
    onOpen: onCancelOpen,
    onClose: onCancelClose,
  } = useDisclosure();

  const [photoUrl, setPhotoUrl] = useState("");

  const user = useAdminUser((store) => store.adminUser);

  /* =======================================================
     REACT QUERY
  ======================================================= */

  const { data: employee } = useEmployee(leave.employeeId);

  const updateEmployeeMutation = useUpdateEmployee();

  const updateLeaveMutation = useUpdateLeave(user.companyId);

  const cancelLeaveMutation = useCancelLeave(user.companyId);

  /* =======================================================
     LEAVE DATA
  ======================================================= */

  const {
    _id,
    firstName,
    lastName,
    employeeId,
    startDate,
    endDate,
    subject,
    notes,
    status,
  } = leave;

  /*
   * Employee React Query cache is the primary source.
   *
   * The leave value is only a fallback in case the employee
   * query has not loaded yet.
   */
  const remainingLeave = employee?.remainingLeave ?? leave.remainingLeave ?? 0;

  /* =======================================================
     CALCULATE LEAVE DAYS
  ======================================================= */

  const calculateLeaveDays = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      return 0;
    }

    return (
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );
  };

  /* =======================================================
     EMPLOYEE PHOTO
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    const loadPhoto = async () => {
      if (!employee?.photo_path) {
        setPhotoUrl("");
        return;
      }

      try {
        const base64 = await window.electron.employees.getPhotoUrl(
          employee.photo_path
        );

        if (cancelled) return;

        setPhotoUrl(`data:image/jpeg;base64,${base64}`);
      } catch (error) {
        if (cancelled) return;

        console.error("ERROR WHILE LOADING EMPLOYEE PHOTO:", error);

        setPhotoUrl("");
      }
    };

    loadPhoto();

    return () => {
      cancelled = true;
    };
  }, [employee?.photo_path]);

  /* =======================================================
     APPROVE LEAVE
  ======================================================= */

  const handleApprove = async () => {
    if (!employee) {
      toast({
        title: "Employé introuvable",
        description: "Impossible de récupérer les informations de l'employé.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top-right",
      });

      return;
    }

    try {
      const leaveDays = calculateLeaveDays();

      /* ---------------------------------------------------
         VALIDATE DATES
      --------------------------------------------------- */

      if (leaveDays <= 0) {
        toast({
          title: "Dates invalides",
          description:
            "La date de fin ne peut pas être antérieure à la date de début.",
          status: "error",
          duration: 5000,
          isClosable: true,
          position: "top-right",
        });

        return;
      }

      console.log("LEAVE DAYS:", leaveDays);

      /* ---------------------------------------------------
         CURRENT EMPLOYEE BALANCE
      --------------------------------------------------- */

      const currentRemainingLeave = employee.remainingLeave ?? 0;

      console.log("CURRENT REMAINING LEAVE:", currentRemainingLeave);

      /* ---------------------------------------------------
         VALIDATE BALANCE
      --------------------------------------------------- */

      if (leaveDays > currentRemainingLeave) {
        toast({
          title: "Solde de congé insuffisant",
          description: `L'employé dispose de ${currentRemainingLeave} jour${
            currentRemainingLeave !== 1 ? "s" : ""
          } de congé restant${
            currentRemainingLeave !== 1 ? "s" : ""
          }, mais ${leaveDays} jour${
            leaveDays !== 1 ? "s" : ""
          } sont demandés.`,
          status: "warning",
          duration: 5000,
          isClosable: true,
          position: "top-right",
        });

        return;
      }

      /* ---------------------------------------------------
         CALCULATE NEW BALANCE
      --------------------------------------------------- */

      const updatedRemainingLeave = currentRemainingLeave - leaveDays;

      console.log("UPDATED REMAINING LEAVE:", updatedRemainingLeave);

      /* ---------------------------------------------------
         UPDATE EMPLOYEE THROUGH REACT QUERY
      --------------------------------------------------- */

      await updateEmployeeMutation.mutateAsync({
        companyId: user.companyId,
        _id: employeeId,
        data: {
          remainingLeave: updatedRemainingLeave,
        },
      });

      /* ---------------------------------------------------
         APPROVE LEAVE THROUGH REACT QUERY
      --------------------------------------------------- */

      const updatedLeave = await updateLeaveMutation.mutateAsync({
        _id,
        updates: {
          status: "APPROUVÉ",
        },
      });

      console.log("UPDATED LEAVE:", updatedLeave);

      toast({
        title: "Congé approuvé",
        description: "La demande de congé a été approuvée avec succès.",
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "top-right",
      });
    } catch (error) {
      console.error("AN ERROR OCCURRED WHILE APPROVING LEAVE:", error);

      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'approbation du congé.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top-right",
      });
    }
  };

  /* =======================================================
     DENY LEAVE
  ======================================================= */

  const handleDeny = async () => {
    try {
      const updatedLeave = await updateLeaveMutation.mutateAsync({
        _id,
        updates: {
          status: "REFUSÉ",
        },
      });

      console.log("DENIED LEAVE:", updatedLeave);

      toast({
        title: "Demande refusée",
        description: "La demande de congé a été refusée.",
        status: "info",
        duration: 3000,
        isClosable: true,
        position: "top-right",
      });
    } catch (error) {
      console.error("AN ERROR OCCURRED WHILE DENYING LEAVE:", error);

      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors du refus du congé.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top-right",
      });
    }
  };

  /* =======================================================
     CANCEL APPROVED LEAVE
  ======================================================= */

  const handleCancelConfirmation = async () => {
    if (!_id || !employee) {
      return;
    }

    try {
      /*
       * Calculate how many days were originally deducted.
       */
      const leaveDays = calculateLeaveDays();

      if (leaveDays <= 0) {
        toast({
          title: "Dates invalides",
          description:
            "Impossible de calculer le nombre de jours de congé à restituer.",
          status: "error",
          duration: 5000,
          isClosable: true,
          position: "top-right",
        });

        return;
      }

      console.log("CANCELLED LEAVE DAYS TO RESTORE:", leaveDays);

      /*
       * Current balance comes from the React Query
       * employee cache.
       */
      const currentRemainingLeave = employee.remainingLeave ?? 0;

      /*
       * Restore the days that were deducted when
       * the leave was approved.
       */
      const restoredRemainingLeave = currentRemainingLeave + leaveDays;

      console.log("CURRENT REMAINING LEAVE:", currentRemainingLeave);

      console.log("RESTORED REMAINING LEAVE:", restoredRemainingLeave);

      /* -------------------------------------------------
           CANCEL THE LEAVE
        ------------------------------------------------- */

      const cancelledLeave = await cancelLeaveMutation.mutateAsync(_id);

      console.log("CANCELLED LEAVE:", cancelledLeave);

      /* -------------------------------------------------
           RESTORE EMPLOYEE LEAVE BALANCE
        ------------------------------------------------- */

      await updateEmployeeMutation.mutateAsync({
        companyId: user.companyId,
        _id: employeeId,
        data: {
          remainingLeave: restoredRemainingLeave,
        },
      });

      console.log("EMPLOYEE LEAVE BALANCE RESTORED");

      /* -------------------------------------------------
           CLOSE DIALOG
        ------------------------------------------------- */

      onCancelClose();

      toast({
        title: "Congé annulé",
        description: `${leaveDays} jour${leaveDays !== 1 ? "s" : ""} de congé ${
          leaveDays !== 1 ? "ont" : "a"
        } été restitué${leaveDays !== 1 ? "s" : ""} à l'employé.`,
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "top-right",
      });
    } catch (error) {
      console.error("AN ERROR OCCURRED WHILE CANCELLING LEAVE:", error);

      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'annulation du congé.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top-right",
      });
    }
  };

  /* =======================================================
     LOADING STATES
  ======================================================= */

  const isApproving =
    updateEmployeeMutation.isPending || updateLeaveMutation.isPending;

  const isCancelling =
    cancelLeaveMutation.isPending || updateEmployeeMutation.isPending;

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <Grid
      templateColumns={gridTemplate}
      alignItems="center"
      ml="1rem"
      px={3}
      py={3}
      bg="#ffffff"
      border="1px solid #E2E8F0"
      borderWidth="0.3px"
      boxShadow="0 2px 10px rgba(15,23,42,.06)"
      maxH="5.5rem"
      width="80vw"
      marginBottom="0.8px"
    >
      {/* ===================================================
          EMPLOYEE
      =================================================== */}

      <Box>
        <HStack>
          <Image
            src={photoUrl || defaultAvatar}
            boxSize="70px"
            borderRadius="full"
            fit="cover"
            fallbackSrc={defaultAvatar}
          />

          <Text
            color="gray.800"
            fontWeight="500"
            fontSize="1.05rem"
            whiteSpace="normal"
            wordBreak="break-word"
            maxW="7rem"
            noOfLines={2}
          >
            {firstName} {lastName}
          </Text>
        </HStack>
      </Box>

      {/* ===================================================
          START DATE
      =================================================== */}

      <Box>
        <Text ml="0.5rem" color="gray.600" fontWeight="500" fontSize="1.05rem">
          {new Date(startDate).toLocaleDateString("fr-FR")}
        </Text>
      </Box>

      {/* ===================================================
          END DATE
      =================================================== */}

      <Box>
        <Text color="gray.600" fontWeight="500" fontSize="1.05rem">
          {new Date(endDate).toLocaleDateString("fr-FR")}
        </Text>
      </Box>

      {/* ===================================================
          NOTES
      =================================================== */}

      <Box>
        <LeaveNotesPopover subject={subject} notes={notes} />
      </Box>

      {/* ===================================================
          STATUS
      =================================================== */}

      <Box width="7rem">
        {status === "ATTENTE_APPROBATION" ? (
          <Text
            color="yellow.600"
            fontWeight="600"
            fontSize="1rem"
            whiteSpace="normal"
            wordBreak="break-word"
          >
            Attente approbation
          </Text>
        ) : (
          <Text
            color={
              status === "APPROUVÉ"
                ? "green.700"
                : status === "REFUSÉ"
                ? "#FC8181"
                : "yellow.500"
            }
            fontWeight="600"
            fontSize="1rem"
            whiteSpace="normal"
            wordBreak="break-word"
          >
            {status}
          </Text>
        )}
      </Box>

      {/* ===================================================
          REMAINING LEAVE
      =================================================== */}

      <Box position="relative" left="1rem">
        <Text color="gray.800" fontSize="1rem">
          {remainingLeave}
        </Text>
      </Box>

      {/* ===================================================
          ACTIONS
      =================================================== */}

      {user.role === "MANAGER" ? (
        <Box>
          <Text color="gray.200" fontSize="1.1rem">
            <Menu placement="left">
              <MenuButton
                mb={10}
                as={IconButton}
                icon={<PiDotsThreeOutlineVerticalDuotone size="1.5rem" />}
                variant="ghost"
                size="1rem"
                borderRadius="full"
                fontWeight="600"
                color="red.600"
                _hover={{
                  bg: "#1D326B",
                  color: "white",
                }}
                _expanded={{
                  bg: "#ffffff",
                }}
                aria-label="Actions"
                position="relative"
                top="1rem"
                left="2rem"
              />

              <MenuList
                bg="#132250"
                border="1px solid #2A3D70"
                borderRadius="14px"
                minW="170px"
                p="6px"
                boxShadow="0 8px 30px rgba(0,0,0,0.35)"
              >
                {status === "ATTENTE_APPROBATION" ? (
                  <>
                    {/* APPROVE */}

                    <MenuItem
                      fontWeight="600"
                      mb={2}
                      icon={
                        <IoIosCheckmarkCircleOutline
                          color="green.300"
                          size="20px"
                        />
                      }
                      borderBottom="1px solid #2A3D70"
                      bg="transparent"
                      color="white"
                      borderRadius="10px"
                      _hover={{
                        bg: "#1D326B",
                      }}
                      isDisabled={isApproving}
                      onClick={handleApprove}
                    >
                      {isApproving ? "Traitement..." : "Approuver"}
                    </MenuItem>

                    {/* DENY */}

                    <MenuItem
                      fontWeight="600"
                      icon={<TiDeleteOutline color="orange.300" size="20px" />}
                      bg="transparent"
                      borderBottom="1px solid #2A3D70"
                      color="white"
                      borderRadius="10px"
                      _hover={{
                        bg: "#1D326B",
                      }}
                      onClick={handleDeny}
                      isDisabled={isApproving}
                      mb={2}
                    >
                      {updateLeaveMutation.isPending
                        ? "Traitement..."
                        : "Refuser"}
                    </MenuItem>

                    {/* EDIT */}

                    <MenuItem
                      icon={<FaRegEdit color="orange.300" size="20px" />}
                      bg="transparent"
                      color="white"
                      borderRadius="10px"
                      _hover={{
                        bg: "#1D326B",
                      }}
                      onClick={onOpen}
                    >
                      <Text fontWeight="600">Modifier</Text>

                      <LeaveEdit
                        leave={leave}
                        isOpen={isOpen}
                        onClose={onClose}
                        onUpdated={() => {}}
                      />
                    </MenuItem>
                  </>
                ) : status === "APPROUVÉ" ? (
                  /* CANCEL */

                  <MenuItem
                    height="20px"
                    mb={2}
                    pt={3}
                    icon={
                      <MdOutlineDeleteForever color="red.300" size="20px" />
                    }
                    bg="transparent"
                    color="gray.200"
                    borderRadius="10px"
                    _hover={{
                      bg: "rgba(255,0,0,0.08)",
                    }}
                    isDisabled={isCancelling}
                    onClick={onCancelOpen}
                  >
                    {isCancelling ? "Annulation..." : "Annuler"}
                  </MenuItem>
                ) : (
                  /* DELETE */

                  <MenuItem
                    height="20px"
                    mb={2}
                    pt={3}
                    icon={
                      <MdOutlineDeleteForever color="red.300" size="20px" />
                    }
                    bg="transparent"
                    color="gray.200"
                    borderRadius="10px"
                    _hover={{
                      bg: "rgba(255,0,0,0.08)",
                    }}
                    onClick={onDelete}
                  >
                    Supprimer
                  </MenuItem>
                )}
              </MenuList>
            </Menu>
          </Text>
        </Box>
      ) : (
        /* =================================================
           ADMIN / OTHER ROLE
        ================================================= */

        <Box>
          <Text color="gray.200" fontSize="1.1rem">
            <Menu placement="left">
              <MenuButton
                mb={10}
                as={IconButton}
                icon={<PiDotsThreeOutlineVerticalDuotone size="1.6rem" />}
                color="brown"
                variant="ghost"
                borderRadius="full"
                _hover={{
                  bg: "transparent",
                }}
                _expanded={{
                  bg: "transparent",
                }}
                aria-label="Actions"
                position="relative"
                top="1rem"
              />

              {status === "ATTENTE_APPROBATION" && (
                <MenuList
                  bg="#132250"
                  border="1px solid #2A3D70"
                  borderRadius="14px"
                  minW="170px"
                  p="6px"
                  boxShadow="0 8px 30px rgba(0,0,0,0.35)"
                >
                  {/* EDIT */}

                  <MenuItem
                    icon={<FaRegEdit color="orange.300" size="1rem" />}
                    bg="transparent"
                    color="white"
                    borderRadius="10px"
                    _hover={{
                      bg: "#1D326B",
                    }}
                    onClick={onOpen}
                    fontSize="1.1rem"
                    height="2.2rem"
                  >
                    Modifier la demande
                  </MenuItem>

                  <LeaveEdit
                    leave={leave}
                    onUpdated={() => {}}
                    isOpen={isOpen}
                    onClose={onClose}
                  />

                  {/* DELETE */}

                  <MenuItem
                    bg="transparent"
                    borderTop="1px solid #2A3D70"
                    height="2.2rem"
                    color="white"
                    borderRadius="10px"
                    _hover={{
                      bg: "#1D326B",
                    }}
                    onClick={onDelete}
                    icon={
                      <MdOutlineDeleteForever color="red.300" size="1.2rem" />
                    }
                  >
                    <Text fontWeight="600" fontSize="1.1rem">
                      Annuler
                    </Text>
                  </MenuItem>
                </MenuList>
              )}
            </Menu>
          </Text>
        </Box>
      )}

      {/* =====================================================
          CANCEL CONFIRMATION
      ===================================================== */}

      <DeletionDialog
        isOpen={isCancelOpen}
        onClose={onCancelClose}
        onConfirmation={handleCancelConfirmation}
        header="Annuler la demande de congé"
        body="Êtes vous sur de vouloir annuler ce congé?"
      />
    </Grid>
  );
};

export default EmployeeLeaveCard;
