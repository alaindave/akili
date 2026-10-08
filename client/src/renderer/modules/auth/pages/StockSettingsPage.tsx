import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Alert,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Tab,
  Table,
  TableContainer,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { FiArrowLeft, FiCheck, FiEdit2, FiPlus } from "react-icons/fi";
import useAdminUser from "../../../../store/auth.store";
import type {
  SkuNumberingSettings,
  StockCategoryInput,
  StockSettingsData,
  StockUnitInput,
} from "../../../../common/types/inventory/StockSettings";
import {
  inventoryError,
  primaryButton,
} from "../../inventory/components/InventoryItemForm";

const emptyCategory: StockCategoryInput = {
  code: "",
  name: "",
  isActive: true,
};
const emptyUnit: StockUnitInput = {
  code: "",
  name: "",
  category: "QUANTITY",
  decimalPlaces: 0,
};
const measures = {
  QUANTITY: "Quantité",
  WEIGHT: "Poids",
  VOLUME: "Volume",
  LENGTH: "Longueur",
  AREA: "Surface",
};
const card = {
  bg: "white",
  border: "1px solid #E5E5E5",
  borderRadius: "12px",
  p: { base: 4, md: 6 },
};

export default function StockSettingsPage() {
  const companyId = useAdminUser((store) => store.adminUser.companyId);
  return companyId ? (
    <CompanyStockSettings key={companyId} companyId={companyId} />
  ) : (
    <Alert>Connectez-vous à une entreprise pour configurer les stocks.</Alert>
  );
}

function CompanyStockSettings({ companyId }: { companyId: string }) {
  const api = window.electron.inventory.settings;
  const [data, setData] = useState<StockSettingsData | null>(null);
  const [numbering, setNumbering] = useState<SkuNumberingSettings>({
    enabled: false,
  });
  const [category, setCategory] = useState<StockCategoryInput>(emptyCategory);
  const [unit, setUnit] = useState<StockUnitInput>(emptyUnit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [archive, setArchive] = useState<{
    kind: "category" | "unit";
    id: string;
    name: string;
  } | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const working = useRef(false);
  const toast = useToast();

  useEffect(() => {
    let active = true;
    setLoadError("");
    api
      .get(companyId)
      .then((result) => {
        if (active) {
          setData(result);
          setNumbering(result.numbering);
        }
      })
      .catch((err) => {
        if (active) setLoadError(inventoryError(err));
      });
    return () => {
      active = false;
    };
  }, [companyId, retry]);

  async function mutate(operation: () => Promise<void>, success: string) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
      const result = await api.get(companyId);
      setData(result);
      toast({
        title: success,
        icon: <FiCheck />,
        duration: 3500,
        isClosable: true,
      });
    } catch (err) {
      setError(inventoryError(err));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  function saveCategory(event: FormEvent) {
    event.preventDefault();
    if (!category.name.trim()) {
      setError("Le nom de la catégorie est obligatoire.");
      return;
    }
    void mutate(async () => {
      await api.saveCategory(companyId, category);
      setCategory(emptyCategory);
    }, "Catégorie enregistrée");
  }
  function saveUnit(event: FormEvent) {
    event.preventDefault();
    if (!unit.name.trim() || !unit.code.trim()) {
      setError("Le code et le nom de l’unité sont obligatoires.");
      return;
    }
    void mutate(async () => {
      await api.saveUnit(companyId, unit);
      setUnit(emptyUnit);
    }, "Unité enregistrée");
  }
  function saveNumbering(event: FormEvent) {
    event.preventDefault();
    void mutate(async () => {
      setNumbering(await api.saveNumbering(companyId, numbering));
    }, "Numérotation enregistrée");
  }
  function archiveSelected() {
    if (!archive) return;
    const selected = archive;
    setArchive(null);
    void mutate(async () => {
      if (selected.kind === "category") {
        await api.archiveCategory(companyId, selected.id);
        if (category.id === selected.id) setCategory(emptyCategory);
      } else {
        await api.archiveUnit(companyId, selected.id);
        if (unit.id === selected.id) setUnit(emptyUnit);
      }
    }, "Élément archivé");
  }

  return (
    <Box
      bg="#FAFAFA"
      minH="100vh"
      color="#262626"
      p={{ base: 5, md: 9 }}
      sx={{
        "input:focus, select:focus": {
          borderColor: "#525252",
          boxShadow: "0 0 0 1px #525252",
        },
        label: { fontSize: "sm" },
      }}
    >
      <Box maxW="1200px" mx="auto">
        <Button
          as={Link}
          to="/admin/settings"
          variant="ghost"
          leftIcon={<FiArrowLeft />}
          size="sm"
          mb={6}
          px={0}
          color="#737373"
        >
          Paramètres
        </Button>
        <Heading fontSize="28px" fontWeight="650" letterSpacing="-0.7px">
          Paramètres de stocks
        </Heading>
        <Text mt={2} mb={8} color="#737373" fontSize="sm">
          Organisez votre catalogue et définissez la numérotation de vos
          articles.
        </Text>
        {loadError ? (
          <Stack {...card}>
            <Text role="alert">{loadError}</Text>
            <Button
              alignSelf="start"
              onClick={() => setRetry((value) => value + 1)}
            >
              Réessayer
            </Button>
          </Stack>
        ) : !data ? (
          <Flex py={12} justify="center">
            <Spinner aria-label="Chargement des paramètres" />
          </Flex>
        ) : (
          <>
            {error && (
              <Alert
                role="alert"
                bg="#F0F0F0"
                border="1px solid #D4D4D4"
                borderRadius="md"
                mb={5}
              >
                {error}
              </Alert>
            )}
            <Tabs colorScheme="gray" isLazy onChange={() => setError("")}>
              <TabList borderColor="#E5E5E5" mb={6} overflowX="auto">
                <Tab isDisabled={busy}>
                  Catégories{" "}
                  <Badge ml={2} borderRadius="full">
                    {data.categories.length}
                  </Badge>
                </Tab>
                <Tab isDisabled={busy}>
                  Unités de mesure{" "}
                  <Badge ml={2} borderRadius="full">
                    {data.units.length}
                  </Badge>
                </Tab>
                <Tab isDisabled={busy}>Numérotation</Tab>
              </TabList>
              <TabPanels>
                <TabPanel p={0}>
                  <SimpleGrid
                    columns={{ base: 1, lg: 2 }}
                    spacing={6}
                    alignItems="start"
                  >
                    <Box {...card}>
                      <Heading size="sm" mb={2}>
                        Catégories d’articles
                      </Heading>
                      <Text color="#737373" fontSize="sm" mb={5}>
                        Classez vos matières et produits. Seules les catégories
                        actives sont proposées lors de la création d’un article.
                      </Text>
                      {data.categories.length === 0 ? (
                        <Text py={8} color="#858585" textAlign="center">
                          Aucune catégorie. Créez votre première catégorie.
                        </Text>
                      ) : (
                        <TableContainer>
                          <Table size="sm">
                            <Thead>
                              <Tr>
                                <Th>Catégorie</Th>
                                <Th>Statut</Th>
                                <Th textAlign="right">Actions</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {data.categories.map((row) => (
                                <Tr key={row._id}>
                                  <Td py={4}>
                                    <Text fontWeight="600">{row.name}</Text>
                                    <Text fontSize="xs" color="#858585" mt={1}>
                                      {row.code || "Sans code"}
                                    </Text>
                                  </Td>
                                  <Td>
                                    <Badge textTransform="none" bg="#F1F1F1">
                                      {row.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                  </Td>
                                  <Td>
                                    <HStack justify="end">
                                      <Button
                                        size="xs"
                                        variant="ghost"
                                        aria-label={`Modifier ${row.name}`}
                                        isDisabled={busy}
                                        onClick={() =>
                                          setCategory({
                                            id: row._id,
                                            code: row.code ?? "",
                                            name: row.name,
                                            isActive: row.isActive,
                                          })
                                        }
                                      >
                                        <FiEdit2 />
                                      </Button>
                                      <Button
                                        size="xs"
                                        variant="ghost"
                                        isDisabled={busy}
                                        onClick={() =>
                                          setArchive({
                                            kind: "category",
                                            id: row._id,
                                            name: row.name,
                                          })
                                        }
                                      >
                                        Archiver
                                      </Button>
                                    </HStack>
                                  </Td>
                                </Tr>
                              ))}
                            </Tbody>
                          </Table>
                        </TableContainer>
                      )}
                    </Box>
                    <Box {...card} as="form" onSubmit={saveCategory}>
                      <Heading size="sm" mb={5}>
                        {category.id
                          ? "Modifier la catégorie"
                          : "Nouvelle catégorie"}
                      </Heading>
                      <Stack
                        spacing={4}
                        as="fieldset"
                        disabled={busy}
                        border={0}
                        p={0}
                        minW={0}
                      >
                        <FormControl isRequired>
                          <FormLabel htmlFor="category-name">Nom</FormLabel>
                          <Input
                            id="category-name"
                            maxLength={100}
                            value={category.name}
                            placeholder="Ex. Cuir"
                            onChange={(e) =>
                              setCategory({ ...category, name: e.target.value })
                            }
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel htmlFor="category-code">Code </FormLabel>
                          <Input
                            id="category-code"
                            maxLength={30}
                            value={category.code ?? ""}
                            placeholder="Ex. MAT"
                            onChange={(e) =>
                              setCategory({ ...category, code: e.target.value })
                            }
                          />
                        </FormControl>
                        <Checkbox
                          colorScheme="blackAlpha"
                          isChecked={category.isActive}
                          onChange={(e) =>
                            setCategory({
                              ...category,
                              isActive: e.target.checked,
                            })
                          }
                        >
                          Catégorie active
                        </Checkbox>
                        <HStack pt={2}>
                          <Button
                            type="submit"
                            {...primaryButton}
                            size="sm"
                            isLoading={busy}
                            leftIcon={category.id ? <FiCheck /> : <FiPlus />}
                          >
                            Enregistrer
                          </Button>
                          {category.id && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setCategory(emptyCategory)}
                            >
                              Annuler
                            </Button>
                          )}
                        </HStack>
                      </Stack>
                    </Box>
                  </SimpleGrid>
                </TabPanel>
                <TabPanel p={0}>
                  <SimpleGrid
                    columns={{ base: 1, lg: 2 }}
                    spacing={6}
                    alignItems="start"
                  >
                    <Box {...card}>
                      <Heading size="sm" mb={2}>
                        Unités de mesure
                      </Heading>
                      <Text color="#737373" fontSize="sm" mb={5}>
                        Définissez les unités utilisées pour mesurer les
                        quantités de vos articles.
                      </Text>
                      {data.units.length === 0 ? (
                        <Text py={8} color="#858585" textAlign="center">
                          Aucune unité de mesure configurée.
                        </Text>
                      ) : (
                        <TableContainer>
                          <Table size="sm">
                            <Thead>
                              <Tr>
                                <Th>Unité</Th>
                                <Th>Mesure</Th>
                                <Th textAlign="right">Actions</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {data.units.map((row) => (
                                <Tr key={row._id}>
                                  <Td py={4}>
                                    <Text fontWeight="600">
                                      {row.name}{" "}
                                      <Text
                                        as="span"
                                        color="#858585"
                                        fontWeight="normal"
                                      >
                                        ({row.code})
                                      </Text>
                                    </Text>
                                    <Text fontSize="xs" color="#858585" mt={1}>
                                      {row.decimalPlaces} décimale(s)
                                    </Text>
                                  </Td>
                                  <Td>{measures[row.category]}</Td>
                                  <Td>
                                    <HStack justify="end">
                                      <Button
                                        size="xs"
                                        variant="ghost"
                                        aria-label={`Modifier ${row.name}`}
                                        isDisabled={busy}
                                        onClick={() =>
                                          setUnit({
                                            id: row._id,
                                            code: row.code,
                                            name: row.name,
                                            category: row.category,
                                            decimalPlaces: row.decimalPlaces,
                                          })
                                        }
                                      >
                                        <FiEdit2 />
                                      </Button>
                                      <Button
                                        size="xs"
                                        variant="ghost"
                                        isDisabled={busy}
                                        onClick={() =>
                                          setArchive({
                                            kind: "unit",
                                            id: row._id,
                                            name: row.name,
                                          })
                                        }
                                      >
                                        Archiver
                                      </Button>
                                    </HStack>
                                  </Td>
                                </Tr>
                              ))}
                            </Tbody>
                          </Table>
                        </TableContainer>
                      )}
                    </Box>
                    <Box {...card} as="form" onSubmit={saveUnit}>
                      <Heading size="sm" mb={5}>
                        {unit.id ? "Modifier l’unité" : "Nouvelle unité"}
                      </Heading>
                      <Stack
                        spacing={4}
                        as="fieldset"
                        disabled={busy}
                        border={0}
                        p={0}
                        minW={0}
                      >
                        <SimpleGrid columns={2} spacing={4}>
                          <FormControl isRequired>
                            <FormLabel htmlFor="stock-unit-code">
                              Code
                            </FormLabel>
                            <Input
                              id="stock-unit-code"
                              maxLength={30}
                              value={unit.code}
                              placeholder="Ex. KG"
                              onChange={(e) =>
                                setUnit({ ...unit, code: e.target.value })
                              }
                            />
                          </FormControl>
                          <FormControl isRequired>
                            <FormLabel htmlFor="stock-unit-name">Nom</FormLabel>
                            <Input
                              id="stock-unit-name"
                              maxLength={100}
                              value={unit.name}
                              placeholder="Ex. Kilogramme"
                              onChange={(e) =>
                                setUnit({ ...unit, name: e.target.value })
                              }
                            />
                          </FormControl>
                        </SimpleGrid>
                        <FormControl isRequired>
                          <FormLabel htmlFor="stock-unit-measure">
                            Type de mesure
                          </FormLabel>
                          <Select
                            id="stock-unit-measure"
                            value={unit.category}
                            onChange={(e) =>
                              setUnit({
                                ...unit,
                                category: e.target
                                  .value as StockUnitInput["category"],
                              })
                            }
                          >
                            {Object.entries(measures).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </Select>
                        </FormControl>
                        <FormControl isRequired>
                          <FormLabel htmlFor="stock-unit-decimals">
                            Nombre de décimales
                          </FormLabel>
                          <Input
                            id="stock-unit-decimals"
                            type="number"
                            min={0}
                            max={10}
                            step={1}
                            value={
                              Number.isNaN(unit.decimalPlaces)
                                ? ""
                                : unit.decimalPlaces
                            }
                            onChange={(e) =>
                              setUnit({
                                ...unit,
                                decimalPlaces: e.target.valueAsNumber,
                              })
                            }
                          />
                          <FormHelperText>
                            De 0 à 10 décimales pour exprimer les quantités.
                          </FormHelperText>
                        </FormControl>
                        <HStack pt={2}>
                          <Button
                            type="submit"
                            {...primaryButton}
                            size="sm"
                            isLoading={busy}
                            leftIcon={unit.id ? <FiCheck /> : <FiPlus />}
                          >
                            Enregistrer
                          </Button>
                          {unit.id && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setUnit(emptyUnit)}
                            >
                              Annuler
                            </Button>
                          )}
                        </HStack>
                      </Stack>
                    </Box>
                  </SimpleGrid>
                </TabPanel>
                <TabPanel p={0}>
                  <Box
                    {...card}
                    as="form"
                    maxW="760px"
                    onSubmit={saveNumbering}
                  >
                    <Heading size="sm" mb={2}>
                      Numérotation des articles (SKU)
                    </Heading>
                    <Text color="#737373" fontSize="sm" mb={6}>
                      Attribuez une référence unique à chaque nouvel article.
                      Les références existantes restent inchangées.
                    </Text>
                    <Stack
                      spacing={5}
                      as="fieldset"
                      disabled={busy}
                      border={0}
                      p={0}
                      minW={0}
                    >
                      <Checkbox
                        colorScheme="blackAlpha"
                        isChecked={numbering.enabled}
                        onChange={(e) =>
                          setNumbering({
                            ...numbering,
                            enabled: e.target.checked,
                          })
                        }
                      >
                        Activer la numérotation automatique
                      </Checkbox>
                      <Text fontSize="sm" color="#737373">
                        Les trois premières lettres du nom de la catégorie, en majuscules,
                        suivies d’un tiret et de cinq chiffres aléatoires.
                        Une catégorie est obligatoire pour générer une référence.
                      </Text>
                      <Box
                        border="1px dashed #D4D4D4"
                        bg="#FAFAFA"
                        borderRadius="lg"
                        p={5}
                      >
                        <Text fontSize="xs" color="#737373" mb={2}>
                          APERÇU DE LA RÉFÉRENCE
                        </Text>
                        <Text fontFamily="mono" fontSize="2xl" fontWeight="600">
                          CUI-08342
                        </Text>
                        <Text mt={2} fontSize="xs" color="#737373">
                          Exemple pour la catégorie « Cuir ». La référence est générée à
                          l’enregistrement et vérifiée pour éviter les doublons.
                        </Text>
                      </Box>
                      <Button
                        type="submit"
                        {...primaryButton}
                        alignSelf="start"
                        size="sm"
                        isLoading={busy}
                      >
                        Enregistrer la numérotation
                      </Button>
                    </Stack>
                  </Box>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </>
        )}
        <AlertDialog
          isOpen={Boolean(archive)}
          leastDestructiveRef={cancelRef}
          onClose={() => setArchive(null)}
        >
          <AlertDialogOverlay>
            <AlertDialogContent>
              <AlertDialogHeader>Archiver {archive?.name} ?</AlertDialogHeader>
              <AlertDialogBody>
                Cet élément ne sera plus proposé pour les nouveaux articles. Un
                élément déjà utilisé ne peut pas être archivé.
              </AlertDialogBody>
              <AlertDialogFooter>
                <Button ref={cancelRef} onClick={() => setArchive(null)}>
                  Annuler
                </Button>
                <Button {...primaryButton} ml={3} onClick={archiveSelected}>
                  Archiver
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogOverlay>
        </AlertDialog>
      </Box>
    </Box>
  );
}
