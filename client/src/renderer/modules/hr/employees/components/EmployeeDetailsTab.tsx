import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  useToast,
  useDisclosure,
  HStack,
} from "@chakra-ui/react";

import { FaBuilding, FaCalendarAlt, FaHashtag } from "react-icons/fa";
import { FaHouseChimneyWindow } from "react-icons/fa6";
import { GiRelationshipBounds, GiRotaryPhone } from "react-icons/gi";
import { IoPerson } from "react-icons/io5";
import { FaRegTrashCan } from "react-icons/fa6";
import { FaUserEdit } from "react-icons/fa";
import { MdAttachMoney, MdWork } from "react-icons/md";
import { LuPaperclip } from "react-icons/lu";
import useAdminUser from "../../../../../store/auth.store";
import type Employee from "../../../../../common/types/Employee";
import EmployeeDetailsCard from "./EmployeeDetailsCard";
import { useState, useRef, useEffect } from "react";
import { useDeleteEmployee, useEmployee } from "../hooks/useEmployees";
import { EmployeeDocument } from "../../../../../common/types/EmployeeDocuments";
import EmployeeDocumentsList from "./EmployeeDocumentsList";
import UploadDocumentModal from "./EmployeeDocumentUpload.tsx";
import NotAuthorized from "../../../../components/NotAuthorized";
import { ErrorBoundary } from "react-error-boundary";
import UpdateEmployee from "./EmployeeUpdate";
import ComponentErrorFallback from "../../../../components/ComponentErrorFallback";
import DeletionDialog from "../../../../components/DeletionDialog";
import { useNavigate } from "react-router-dom";
import useSyncStore from "../../../../../store/sync.store";

interface Props {
  employee: Employee;
}

interface Props {
  employee: Employee;
}

const EmployeeDetailsTab = ({ employee }: Props) => {
  const { data: currentEmployee, error: employeeError } = useEmployee(
    employee._id
  );
  const { mutateAsync: deleteEmployee, isPending: isDeleting } =
    useDeleteEmployee();
  const displayedEmployee = currentEmployee ?? employee;
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const syncVersion = useSyncStore((store) => store.syncVersion);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const navigate = useNavigate();
  const {
    isOpen: isDocumentDeletionOpen,
    onOpen: onDocumentDeletionOpen,
    onClose: onDocumentDeletionClose,
  } = useDisclosure();
  const {
    isOpen: isEmployeeDeletionOpen,
    onOpen: onEmployeeDeletionOpen,
    onClose: onEmployeeDeletionClose,
  } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const user = useAdminUser((store) => store.adminUser);
  const [documentToDelete, setDocumentToDelete] =
    useState<EmployeeDocument | null>(null);
  const toast = useToast();

  useEffect(() => {
    loadEmployeeDocuments();
  }, [employee, syncVersion]);

  const loadEmployeeDocuments = async () => {
    try {
      const documents = await window.electron.employees_documents.getByEmployee(
        user.companyId,
        displayedEmployee._id
      );
      setDocuments(documents);
      console.log("DOCUMENTS FETCHED:", documents);
    } catch (e) {
      console.error("ERROR FETCHING DOCUMENT:", e);
    }
  };

  const handleView = async (document: EmployeeDocument) => {
    console.log("VIEWING DOCUMENT LOCAL PATH:", document.localPath);

    await window.electron.employees_documents.view(
      user.companyId,
      document.localPath
    );
  };

  const handleDownload = async (document: EmployeeDocument) => {
    console.log("DOWNLOADING DOCUMENT LOCAL PATH:", document.localPath);

    await window.electron.employees_documents.download(
      user.companyId,
      document
    );

    toast({
      title: "Telechargement",
      status: "success",
      duration: 3000,
    });
  };

  const handleDocumentDelete = (document: EmployeeDocument) => {
    setDocumentToDelete(document);
    onDocumentDeletionOpen();
  };

  const confirmDelete = async () => {
    if (!documentToDelete) return;

    try {
      await window.electron.employees_documents.delete(
        user.companyId,
        documentToDelete._id
      );

      setDocuments((prev) =>
        prev.filter((document) => document._id !== documentToDelete._id)
      );

      toast({
        title: "Document supprimé",
        status: "success",
        duration: 3000,
      });

      onDocumentDeletionClose();
    } catch (error) {
      console.error("ERROR DELETING DOCUMENT:", error);

      toast({
        title: "Suppression echouée",
        status: "error",
        duration: 3000,
      });
    } finally {
      setDocumentToDelete(null);
      onClose();
    }
  };

  const handleEmployeeDelete = async () => {
    if (!employee._id) return;
    try {
      await deleteEmployee(employee._id);
      navigate("/employees_admin/employees_list");
    } catch (error) {
      console.error("UNABLE TO DELETE EMPLOYEE:", error);
    }
  };

  if (employeeError) {
    console.error("ERROR FETCHING EMPLOYEE:", employeeError);
  }

  return (
    <Box w="47vw" maxH="90vh" h="90vh" display="flex" flexDirection="column">
      <Tabs
        variant="enclosed"
        flex="1"
        minH={0}
        display="flex"
        flexDirection="column"
      >
        {/* ==================== TABS ==================== */}

        <TabList
          flexShrink={0}
          position="sticky"
          top={0}
          zIndex={10}
          bg="white"
          borderBottomColor="rgba(255,255,255,0.08)"
          overflowX="auto"
          overflowY="auto"
          whiteSpace="nowrap"
          sx={{
            "&::-webkit-scrollbar": {
              height: "4px",
            },
          }}
        >
          <Tab
            flexShrink={0}
            color="gray.600"
            fontSize={{ base: "sm", md: "md", lg: "lg" }}
            fontWeight="600"
            px={{ base: 3, md: 5 }}
            _selected={{
              color: "blue.600",
              bg: "transparent",
            }}
            _hover={{
              color: "blue.600",
            }}
          >
            Info personnelles
          </Tab>

          <Tab
            flexShrink={0}
            color="gray.600"
            fontSize={{ base: "sm", md: "md", lg: "lg" }}
            fontWeight="600"
            px={{ base: 3, md: 5 }}
            _selected={{
              color: "blue.600",
              bg: "transparent",
            }}
            _hover={{
              color: "blue.600",
            }}
          >
            Info professionnelles
          </Tab>

          <Tab
            flexShrink={0}
            color="gray.600"
            fontSize={{ base: "sm", md: "md", lg: "lg" }}
            fontWeight="600"
            px={{ base: 3, md: 5 }}
            _selected={{
              color: "blue.600",
              bg: "transparent",
            }}
            _hover={{
              color: "blue.600",
            }}
          >
            Contact
          </Tab>

          <Tab
            flexShrink={0}
            color="gray.600"
            fontSize={{ base: "sm", md: "md", lg: "lg" }}
            fontWeight="600"
            px={{ base: 3, md: 5 }}
            _selected={{
              color: "blue.600",
              bg: "transparent",
            }}
            _hover={{
              color: "blue.600",
            }}
          >
            Documents
          </Tab>
        </TabList>

        {/* ==================== SCROLLABLE CONTENT ==================== */}

        <TabPanels
          flex="1"
          minH={0}
          overflowY="auto"
          overflowX="hidden"
          px={{ base: 2, md: 4 }}
          py={4}
        >
          {/* ==================== PERSONAL INFORMATION ==================== */}

          <TabPanel p={0}>
            <EmployeeDetailsCard
              property="Nom"
              value={displayedEmployee.lastName || "N.D."}
              icon={IoPerson}
            />

            <EmployeeDetailsCard
              property="Prénom"
              value={displayedEmployee.firstName || "N.D."}
              icon={IoPerson}
            />

            <EmployeeDetailsCard
              property="Matricule"
              value={displayedEmployee.matricule || "N.D."}
              icon={FaHashtag}
            />

            <EmployeeDetailsCard
              property="No carte d'identité"
              value={displayedEmployee.idNum || "N.D."}
              icon={FaHashtag}
            />

            <EmployeeDetailsCard
              property="Date de naissance"
              value={
                displayedEmployee.dateBirth
                  ? new Date(displayedEmployee.dateBirth).toLocaleDateString(
                      "fr-FR"
                    )
                  : "N.D."
              }
              icon={FaCalendarAlt}
            />
          </TabPanel>

          {/* ==================== PROFESSIONAL INFORMATION ==================== */}

          <TabPanel p={0}>
            <EmployeeDetailsCard
              property="Poste"
              value={displayedEmployee.role || "N.D."}
              icon={MdWork}
            />

            <EmployeeDetailsCard
              property="Département"
              value={displayedEmployee.department || "N.D."}
              icon={FaBuilding}
            />

            <EmployeeDetailsCard
              property="Salaire"
              value={
                displayedEmployee.salary?.toLocaleString("fr-BI") || "N.D."
              }
              icon={MdAttachMoney}
            />

            <EmployeeDetailsCard
              property="Date d'embauche"
              value={
                displayedEmployee.dateHired
                  ? new Date(displayedEmployee.dateHired).toLocaleDateString(
                      "fr-FR"
                    )
                  : "N.D."
              }
              icon={FaCalendarAlt}
            />

            <EmployeeDetailsCard
              property="Congés restants"
              value={displayedEmployee.remainingLeave || 0}
              icon={FaCalendarAlt}
            />
          </TabPanel>

          {/* ==================== CONTACT ==================== */}

          <TabPanel p={0}>
            <EmployeeDetailsCard
              property="Adresse"
              value={displayedEmployee.address || "N.D."}
              icon={FaHouseChimneyWindow}
            />

            <EmployeeDetailsCard
              property="Téléphone"
              value={displayedEmployee.telephone || "N.D."}
              icon={GiRotaryPhone}
            />

            <EmployeeDetailsCard
              property="Nom du contact d'urgence"
              value={displayedEmployee.emergencyContact || "N.D."}
              icon={IoPerson}
            />

            <EmployeeDetailsCard
              property="Relation avec l'employé"
              value={displayedEmployee.relationship || "N.D."}
              icon={GiRelationshipBounds}
            />

            <EmployeeDetailsCard
              property="Téléphone du contact d'urgence"
              value={displayedEmployee.contactPhone || "N.D."}
              icon={GiRotaryPhone}
            />
          </TabPanel>

          {/* ==================== DOCUMENTS ==================== */}

          <TabPanel p={0}>
            <UploadDocumentModal
              isOpen={isOpen}
              onClose={onClose}
              employeeId={displayedEmployee._id}
              uploadedBy={user._id}
              documentType="EMPLOYMENT_CONTRACT"
              onRefresh={loadEmployeeDocuments}
            />

            <EmployeeDocumentsList
              documents={documents}
              onView={handleView}
              onDownload={handleDownload}
              onDelete={handleDocumentDelete}
            />

            <Button
              position="absolute"
              top="3rem"
              right="0.01rem"
              onClick={onOpen}
              bg="transparent"
              fontSize="1.4rem"
              _hover={{
                bg: "transparent",
              }}
            >
              <LuPaperclip />
            </Button>
          </TabPanel>
        </TabPanels>

        {/* ==================== FIXED BOTTOM ACTION BAR ==================== */}

        <HStack
          flexShrink={0}
          w="100%"
          px={{ base: 2, md: 4 }}
          py={3}
          spacing={3}
          bg="white"
          borderTop="1px solid"
          borderColor="gray.200"
          justifyContent="flex-start"
        >
          {user?.role === "MANAGER" ? (
            <ErrorBoundary FallbackComponent={ComponentErrorFallback}>
              <Box>
                <UpdateEmployee
                  _id={displayedEmployee._id}
                  employee={displayedEmployee}
                />
              </Box>
            </ErrorBoundary>
          ) : (
            <Box>
              <NotAuthorized
                buttonText="Modifier"
                icon={FaUserEdit}
                placement="left"
                width="13rem"
                color="#4F46E5"
              />
            </Box>
          )}

          {user?.role === "MANAGER" ? (
            <Button
              bg="red.100"
              color="red.600"
              width="9rem"
              height="2.3rem"
              fontSize="1rem"
              leftIcon={<FaRegTrashCan fontSize="1.1rem" />}
              onClick={onEmployeeDeletionOpen}
            >
              Supprimer
            </Button>
          ) : (
            <Box>
              <NotAuthorized
                buttonText="Supprimer"
                icon={FaRegTrashCan}
                placement="bottom"
                width="13rem"
                color="red"
              />
            </Box>
          )}
        </HStack>
      </Tabs>

      {/* ==================== DELETE DOCUMENT DIALOG ==================== */}

      <AlertDialog
        isOpen={isDocumentDeletionOpen}
        leastDestructiveRef={cancelRef}
        onClose={() => {
          setDocumentToDelete(null);
          onDocumentDeletionClose();
        }}
      >
        <AlertDialogOverlay backdropFilter="auto" backdropBlur="0.5rem">
          <AlertDialogContent
            bg="white"
            color="#1F2937"
            borderRadius="10px"
            border="1px solid #CBD5E1"
            boxShadow="0 12px 35px rgba(15, 23, 42, 0.18)"
            overflow="hidden"
            mx={4}
            position="relative"
            top="6rem"
          >
            <AlertDialogHeader>Supprimer le document</AlertDialogHeader>

            <AlertDialogBody>
              {documentToDelete ? (
                <>
                  Êtes vous sur de vouloir supprimer{" "}
                  <strong style={{ color: "#F2B705" }}>
                    {documentToDelete.originalName}
                  </strong>
                  ?
                  <br />
                </>
              ) : (
                "Êtes vous sur de vouloir supprimer ce document"
              )}
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDocumentDeletionClose}>
                Annuler
              </Button>

              <Button colorScheme="red" ml={3} onClick={confirmDelete}>
                Supprimer
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
      <DeletionDialog
        header="Supprimer l'employé"
        employee={employee}
        onConfirmation={handleEmployeeDelete}
        isOpen={isEmployeeDeletionOpen}
        onClose={onEmployeeDeletionClose}
        isDeleting={isDeleting}
      />
    </Box>
  );
};

export default EmployeeDetailsTab;
