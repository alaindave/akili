import PayrollResultAuditPopover from "../components/PayrollResultAuditPopover";
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Tfoot,
  Tr,
  useToast,
} from "@chakra-ui/react";
import { FaArrowLeftLong } from "react-icons/fa6";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  PayslipDocumentData,
  payslipPeriod,
  payslipRows,
} from "../../../../../common/types/hr/payroll/PayslipDocument";
import useSyncStore from "../../../../../store/sync.store";
import useAdminUser from "../../../../../store/auth.store";

export default function EmployeePayslipDetails() {
  const { _id: employeeId, payslipId } = useParams();

  const user = useAdminUser((store) => store.adminUser);

  const syncVersion = useSyncStore((store) => store.syncVersion);

  const navigate = useNavigate();

  const toast = useToast();

  const [data, setData] = useState<PayslipDocumentData | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [revision, setRevision] = useState(0);

  const [isUpdating, setIsUpdating] = useState(false);

  const [isDownloading, setIsDownloading] = useState(false);

  const api = window.electron.hr.payrollRun;

  const viewportRef = useRef<HTMLDivElement>(null);

  const documentRef = useRef<HTMLDivElement>(null);

  const [documentScale, setDocumentScale] = useState(1);

  const bottomPaperMargin = 50;

  const formatMoney = (value: number) => {
    const amount = Math.round(Number(value) || 0);

    const formattedAmount = amount
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, " ");

    return `${formattedAmount} ${data?.currency || ""}`.trim();
  };

  /*
   * Fit the payslip inside the available viewport while
   * preserving a real visible margin underneath it.
   */
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const document = documentRef.current;

    if (!viewport || !document) return;

    const fitDocument = () => {
      const paperHeight = document.offsetHeight;

      if (paperHeight <= 0) return;

      /*
       * Reserve actual visible space underneath the paper.
       */
      const availableHeight = viewport.clientHeight - bottomPaperMargin;

      if (availableHeight <= 0) {
        setDocumentScale(0.8);
        return;
      }

      const scale = Math.min(1, availableHeight / paperHeight);

      setDocumentScale(scale);
    };

    const observer = new ResizeObserver(fitDocument);

    observer.observe(viewport);
    observer.observe(document);

    fitDocument();

    return () => observer.disconnect();
  }, [data, loading, error]);

  /*
   * Load payslip.
   */
  useEffect(() => {
    let active = true;

    setLoading(true);
    setData(null);
    setError("");

    if (!employeeId || !payslipId) {
      setError("Bulletin de paie introuvable.");
      setLoading(false);
      return;
    }

    api
      .getPayslipDocument(user.companyId, employeeId, payslipId)
      .then((value) => {
        if (active) {
          setData(value);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Impossible de charger le bulletin de paie."
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [employeeId, payslipId, user.companyId, syncVersion, revision]);

  /*
   * Display errors using Chakra toast.
   */
  const showError = (title: string, cause: unknown) =>
    toast({
      title,
      description:
        cause instanceof Error ? cause.message : "Veuillez réessayer.",
      status: "error",
      isClosable: true,
    });

  /*
   * Download payslip.
   */
  const download = async () => {
    if (!employeeId || !payslipId || !data || isDownloading || isUpdating) {
      return;
    }

    setIsDownloading(true);

    try {
      const result = await api.savePayslipReport(
        user.companyId,
        employeeId,
        payslipId
      );

      if (!result.canceled) {
        toast({
          title: "Bulletin de paie enregistré",
          status: "success",
          isClosable: true,
        });
      }
    } catch (cause) {
      showError("Impossible de télécharger le bulletin", cause);
    } finally {
      setIsDownloading(false);
    }
  };

  /*
   * Approve or pay payslip.
   */
  const updatePayslip = async () => {
    if (!data?.payroll._id || isUpdating || isDownloading) {
      return;
    }

    setIsUpdating(true);

    try {
      if (data.payroll.status === "BROUILLON") {
        await api.verifyPayslip(user.companyId, data.payroll._id, user);
      } else if (data.payroll.status === "VERIFIÉ") {
        await api.approvePayslip(user.companyId, data.payroll._id, user);
      } else if (data.payroll.status === "APPROUVÉ") {
        await api.markPayslipAsPaid(user.companyId, data.payroll._id, user);
      } else {
        return;
      }

      setRevision((value) => value + 1);

      window.electron.sync.sync(user.companyId).catch((cause: Error) => {
        console.error("PAYSLIP SYNC FAILED:", cause);
      });
    } catch (cause) {
      showError("Impossible de modifier ce bulletin", cause);
    } finally {
      setIsUpdating(false);
    }
  };

  /*
   * Make sure the loaded document belongs to the
   * employee and payslip requested by the route.
   */
  const ready =
    !loading &&
    data?.employee._id === employeeId &&
    data?.payroll.payrollRunId === payslipId;

  const rows = data ? payslipRows(data) : [];

  const earnings = rows.filter((row) => row.earning !== null);

  const deductions = rows.filter((row) => row.deduction !== null);

  const maxRows = Math.max(earnings.length, deductions.length);

  return (
    <Box
      bg="#f5f5f5"
      color="#171717"
      height="100%"
      minH={0}
      display="flex"
      flexDirection="column"
      overflow="hidden"
      width="100%"
      p={{ base: 3, md: 5 }}
    >
      {/* =========================================================
          PAGE HEADER
      ========================================================= */}

      <Flex
        maxW="1350px"
        width="100%"
        flexShrink={0}
        mx="auto"
        mb={3}
        justify="space-between"
        gap={3}
        flexWrap="wrap"
      >
        {/* Left side */}
        <HStack spacing={4} minW={0}>
          <Button
            size="sm"
            variant="outline"
            colorScheme="gray"
            bg="white"
            flexShrink={0}
            onClick={() => navigate(-1)}
            fontSize="1.1rem"
          >
            <FaArrowLeftLong color="black" />
          </Button>

          <Box position="relative" top="0.4rem">
            <Heading fontSize="1.1rem">Fiche de paie</Heading>

            {data && ready && (
              <Text fontSize="1rem" color="#525252">
                Période du{" "}
                {payslipPeriod(data.payroll.month, data.payroll.year)}
              </Text>
            )}
          </Box>
        </HStack>

        {/* Right side */}
        <HStack spacing={3} flexWrap="wrap">
          {data &&
            ready &&
            ((data.payroll.status === "BROUILLON" &&
              ["ADMIN", "MANAGER"].includes(user.role)) ||
              (user.role === "MANAGER" &&
                (data.payroll.status === "VERIFIÉ" ||
                  data.payroll.status === "APPROUVÉ"))) && (
              <Button
                size="sm"
                variant="outline"
                colorScheme="gray"
                bg="white"
                onClick={updatePayslip}
                isLoading={isUpdating}
                isDisabled={isDownloading}
                fontSize="1.1rem"
              >
                {data.payroll.status === "BROUILLON"
                  ? "Vérifier"
                  : data.payroll.status === "VERIFIÉ"
                  ? "Approuver"
                  : "Payer"}
              </Button>
            )}

          <Button
            size="sm"
            bg="#171717"
            color="white"
            _hover={{
              bg: "#404040",
            }}
            onClick={download}
            isLoading={isDownloading}
            isDisabled={!ready || isUpdating}
            fontSize="1.1rem"
          >
            Télécharger
          </Button>
        </HStack>
      </Flex>

      {/* =========================================================
          PAYSLIP VIEWPORT
      ========================================================= */}

      <Box
        ref={viewportRef}
        flex="1"
        minH={0}
        width="100%"
        mx="auto"
        position="relative"
        overflow="hidden"
        mt="4rem"
      >
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          height={`calc(100% - ${bottomPaperMargin}px)`}
          overflow="hidden"
        >
          {loading ? (
            <Text textAlign="center" py={12} fontSize="1.1rem">
              Chargement du bulletin de paie…
            </Text>
          ) : error ? (
            <Box textAlign="center" py={12}>
              <Text mb={4} fontSize="1.1rem">
                {error}
              </Text>

              <Button
                variant="outline"
                onClick={() => setRevision((value) => value + 1)}
                fontSize="1.1rem"
              >
                Réessayer
              </Button>
            </Box>
          ) : (
            data &&
            ready && (
              <Box
                ref={documentRef}
                as="article"
                position="absolute"
                top={0}
                left="50%"
                width="1100px"
                transform={`translateX(-50%) scale(${documentScale})`}
                transformOrigin="top center"
                aria-label="Bulletin de paie"
                bg="white"
                border="1.5px solid #a8a8a8"
                borderRadius="2px"
                boxShadow="0 2px 12px rgba(0,0,0,0.06)"
                px="85px"
                pt="42px"
                pb="28px"
                fontSize="1.1rem"
                boxSizing="border-box"
              >
                {/* =================================================
                    TOP SECTION
                ================================================= */}

                <Flex
                  width="100%"
                  justify="space-between"
                  align="flex-start"
                  gap={10}
                  pb={6}
                  mb={5}
                  borderBottom="1px solid #d4d4d4"
                >
                  {/* Employee information */}
                  <Box flex="1" minW={0}>
                    <Box width="100%">
                      {[
                        [
                          "Nom de l’employé",
                          `${data.employee.firstName} ${data.employee.lastName}`,
                        ],
                        ["Matricule", data.employee.matricule || "—"],
                        ["Département", data.employee.department || "—"],
                        ["Poste", data.employee.role || "—"],
                      ].map(([label, value]) => (
                        <Flex
                          key={label}
                          align="baseline"
                          minH="38px"
                          borderBottom="1px solid #f0f0f0"
                          py={1}
                        >
                          <Text
                            width="230px"
                            flexShrink={0}
                            fontSize="1.05rem"
                            color="#525252"
                          >
                            {label}
                          </Text>

                          <Text
                            fontSize="1.05rem"
                            fontWeight="600"
                            overflowWrap="anywhere"
                            whiteSpace="normal"
                          >
                            {value}
                          </Text>
                        </Flex>
                      ))}
                    </Box>
                  </Box>

                  {/* =================================================
                      STATUS — TOP RIGHT
                  ================================================= */}

                  <Box flexShrink={0} minW="220px" pt={1} textAlign="right">
                    <Text
                      fontSize="1.05rem"
                      color="#525252"
                      whiteSpace="nowrap"
                    >
                      <PayrollResultAuditPopover payroll={data.payroll} />
                    </Text>
                  </Box>
                </Flex>

                {/* =================================================
                    PAYROLL SECTIONS
                ================================================= */}

                <Flex width="100%" gap="32px" align="stretch">
                  {/* =================================================
                      RÉMUNÉRATIONS
                  ================================================= */}

                  <Box
                    flex="1"
                    minW={0}
                    border="1px solid #d4d4d4"
                    display="flex"
                    flexDirection="column"
                  >
                    <Box
                      bg="#f5f5f5"
                      px={6}
                      py={3}
                      borderBottom="1px solid #d4d4d4"
                      flexShrink={0}
                    >
                      <Text
                        fontSize="1.2rem"
                        fontWeight="700"
                        letterSpacing="0.04em"
                        textTransform="uppercase"
                      >
                        Rémunérations
                      </Text>
                    </Box>

                    <TableContainer
                      maxH="285px"
                      overflowY="auto"
                      overflowX="hidden"
                      px={3}
                      py={2}
                      position="relative"
                    >
                      <Table
                        size="sm"
                        variant="simple"
                        sx={{
                          tableLayout: "auto",

                          "th, td": {
                            borderColor: "#e5e5e5",
                            py: 2.5,
                            px: 3,
                          },

                          td: {
                            fontSize: "1.05rem",
                            verticalAlign: "top",
                          },

                          tfoot: {
                            position: "sticky",
                            bottom: 0,
                            zIndex: 2,
                          },

                          "tfoot td": {
                            position: "sticky",
                            bottom: 0,
                            background: "white",
                            borderTop: "2px solid #171717",
                            boxShadow: "0 -2px 4px rgba(0,0,0,0.05)",
                            zIndex: 2,
                          },
                        }}
                      >
                        <Tbody>
                          {Array.from({
                            length: maxRows,
                          }).map((_, index) => {
                            const row = earnings[index];

                            return (
                              <Tr key={index}>
                                <Td
                                  width="60%"
                                  whiteSpace="normal"
                                  overflowWrap="break-word"
                                  wordBreak="normal"
                                >
                                  {row?.label || "—"}
                                </Td>

                                <Td
                                  width="40%"
                                  isNumeric
                                  whiteSpace="nowrap"
                                  fontWeight="600"
                                >
                                  {row ? formatMoney(row.earning!) : "—"}
                                </Td>
                              </Tr>
                            );
                          })}
                        </Tbody>

                        <Tfoot>
                          <Tr fontWeight="700">
                            <Td fontSize="1.05rem">Total</Td>

                            <Td
                              isNumeric
                              whiteSpace="nowrap"
                              fontSize="1.05rem"
                            >
                              {formatMoney(data.payroll.grossSalary)}
                            </Td>
                          </Tr>
                        </Tfoot>
                      </Table>
                    </TableContainer>
                  </Box>

                  {/* =================================================
                      RETENUES
                  ================================================= */}

                  <Box
                    flex="1"
                    minW={0}
                    border="1px solid #d4d4d4"
                    display="flex"
                    flexDirection="column"
                  >
                    <Box
                      bg="#f5f5f5"
                      px={6}
                      py={3}
                      borderBottom="1px solid #d4d4d4"
                      flexShrink={0}
                    >
                      <Text
                        fontSize="1.2rem"
                        fontWeight="700"
                        letterSpacing="0.04em"
                        textTransform="uppercase"
                      >
                        Retenues
                      </Text>
                    </Box>

                    <TableContainer
                      maxH="285px"
                      overflowY="auto"
                      overflowX="hidden"
                      px={3}
                      py={2}
                      position="relative"
                    >
                      <Table
                        size="sm"
                        variant="simple"
                        sx={{
                          tableLayout: "auto",

                          "th, td": {
                            borderColor: "#e5e5e5",
                            py: 2.5,
                            px: 3,
                          },

                          td: {
                            fontSize: "1.05rem",
                            verticalAlign: "top",
                          },

                          tfoot: {
                            position: "sticky",
                            bottom: 0,
                            zIndex: 2,
                          },

                          "tfoot td": {
                            position: "sticky",
                            bottom: 0,
                            background: "white",
                            borderTop: "2px solid #171717",
                            boxShadow: "0 -2px 4px rgba(0,0,0,0.05)",
                            zIndex: 2,
                          },
                        }}
                      >
                        <Tbody>
                          {Array.from({
                            length: maxRows,
                          }).map((_, index) => {
                            const row = deductions[index];

                            return (
                              <Tr key={index}>
                                <Td
                                  width="60%"
                                  whiteSpace="normal"
                                  overflowWrap="break-word"
                                  wordBreak="normal"
                                >
                                  {row?.label || "—"}
                                </Td>

                                <Td
                                  width="40%"
                                  isNumeric
                                  whiteSpace="nowrap"
                                  fontWeight="600"
                                >
                                  {row ? formatMoney(row.deduction!) : "—"}
                                </Td>
                              </Tr>
                            );
                          })}
                        </Tbody>

                        <Tfoot>
                          <Tr fontWeight="700">
                            <Td fontSize="1.05rem">Total</Td>

                            <Td
                              isNumeric
                              whiteSpace="nowrap"
                              fontSize="1.05rem"
                            >
                              {formatMoney(data.payroll.totalDeductions)}
                            </Td>
                          </Tr>
                        </Tfoot>
                      </Table>
                    </TableContainer>
                  </Box>
                </Flex>

                {/* =================================================
                    NET SALARY
                ================================================= */}

                <Flex
                  justify="space-between"
                  align="center"
                  gap={5}
                  mt={5}
                  py={3}
                  px={5}
                  borderTop="2px solid #171717"
                  borderBottom="2px solid #171717"
                >
                  <Text
                    fontWeight="700"
                    letterSpacing="0.05em"
                    fontSize="1.2rem"
                  >
                    NET À PAYER
                  </Text>

                  <Text fontSize="1.2rem" fontWeight="700" whiteSpace="nowrap">
                    {formatMoney(data.payroll.netSalary)}
                  </Text>
                </Flex>

                {/* Small internal space before paper border */}
                <Box height="20px" />
              </Box>
            )
          )}
        </Box>

        {/* =========================================================
            REAL BOTTOM BREATHING ROOM
        ========================================================= */}

        <Box
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          height={`${bottomPaperMargin}px`}
          pointerEvents="none"
        />
      </Box>
    </Box>
  );
}
