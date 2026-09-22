import PageSubtitle from "../../../components/PageSubtitle";
import {
  Alert,
  AlertIcon,
  Avatar,
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  HStack,
  Input,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { FiCamera, FiSave } from "react-icons/fi";
import { FaArrowLeftLong } from "react-icons/fa6";
import useAdminUser from "../../../../store/auth.store";
import { useNavigate } from "react-router-dom";

interface Company {
  companyId: string;
  name: string;
  legalName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  logoPath?: string | null;
}

interface CompanySettingsForm {
  name: string;
  legalName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  country: string;
}

const CompanySettingsPage = () => {
  const [company, setCompany] = useState<Company | null>(null);
  const user = useAdminUser((store) => store.adminUser);
  const navigate = useNavigate();

  const [form, setForm] = useState<CompanySettingsForm>({
    name: "",
    legalName: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    country: "",
  });

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const loadCompany = async () => {
      try {
        setLoading(true);
        setError("");

        const currentCompany = await window.electron.company.getById(
          user.companyId
        );

        if (!currentCompany) {
          throw new Error("Aucune entreprise sélectionnée.");
        }

        setCompany(currentCompany);

        setForm({
          name: currentCompany.name ?? "",
          legalName: currentCompany.legalName ?? "",
          phone: currentCompany.phone ?? "",
          email: currentCompany.email ?? "",
          address: currentCompany.address ?? "",
          city: currentCompany.city ?? "",
          country: currentCompany.country ?? "",
        });

        /**
         * Load the logo through your Electron file bridge.
         */
        if (currentCompany.logoPath) {
          try {
            const logoUrl = await window.electron.company.getLogoUrl(
              currentCompany.logoPath
            );

            if (logoUrl) {
              setLogoPreview(logoUrl);
            }
          } catch {
            setLogoPreview(null);
          }
        }
      } catch (err) {
        console.error("Failed to load company:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger les informations de l'entreprise."
        );
      } finally {
        setLoading(false);
      }
    };

    loadCompany();
  }, [user.companyId]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setSuccess("");
    setError("");
  };

  const handleLogoClick = () => {
    fileInputRef.current?.click();
  };

  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setError("Veuillez sélectionner une image JPG, PNG ou WEBP.");

      e.target.value = "";
      return;
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      setError("La taille du logo ne doit pas dépasser 5 MB.");

      e.target.value = "";
      return;
    }

    setLogoFile(file);
    setSuccess("");
    setError("");

    const objectUrl = URL.createObjectURL(file);

    setLogoPreview(objectUrl);
  };

  const handleSave = async () => {
    if (!company) {
      return;
    }

    if (!form.name.trim()) {
      setError("Le nom de l'entreprise est obligatoire.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      /**
       * Update company information.
       */
      const updatedCompany = await window.electron.company.update({
        companyId: company.companyId,
        name: form.name.trim(),
        legalName: form.legalName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        country: form.country.trim(),
      });

      /**
       * If a new logo was selected, upload it.
       */
      if (logoFile) {
        const data = await logoFile.arrayBuffer();

        await window.electron.company.updateLogo({
          companyId: company.companyId,
          mimeType: logoFile.type,
          data,
        });

        setLogoFile(null);
      }

      setCompany((previous) => ({
        ...(previous ?? company),
        ...(updatedCompany ?? {}),
        name: form.name.trim(),
        legalName: form.legalName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        country: form.country.trim(),
      }));

      setSuccess("Les informations de l'entreprise ont été enregistrées.");
    } catch (err) {
      console.error("Failed to save company:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'enregistrer les modifications."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Flex w="100%" h="100%" align="center" justify="center">
        <VStack spacing={3}>
          <Spinner size="lg" />
          <Text color="gray.500">Chargement des informations...</Text>
        </VStack>
      </Flex>
    );
  }

  if (!company) {
    return (
      <Box p={8}>
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          {error || "Entreprise introuvable."}
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      w="100%"
      h="100%"
      bg="gray.50"
      overflowY="auto"
      p={{ base: 4, md: 6, lg: 8 }}
    >
      <Box maxW="1100px" mx="auto">
        {/* Header */}
        <HStack>
          <Button
            position="relative"
            bottom="1.5rem"
            mr="1rem"
            p={2}
            border="1px solid #14376b"
            borderRadius="10px"
            _hover={{ bg: "transparent" }}
            onClick={() => navigate("/admin")}
          >
            <FaArrowLeftLong color="black" />
          </Button>
          <Box mb={6}>
            <Text fontSize="2xl" fontWeight="700" color="gray.800">
              Paramètres de l'entreprise
            </Text>
            <PageSubtitle mt={1}>
              Gérez les informations générales et le logo de votre entreprise.
            </PageSubtitle>
          </Box>
        </HStack>

        {/* Alerts */}
        {error && (
          <Alert status="error" mb={5} borderRadius="md">
            <AlertIcon />
            {error}
          </Alert>
        )}

        {success && (
          <Alert status="success" mb={5} borderRadius="md">
            <AlertIcon />
            {success}
          </Alert>
        )}

        <Box
          bg="white"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="lg"
          boxShadow="sm"
          overflow="hidden"
        >
          {/* Company information */}
          <Box p={{ base: 5, md: 7 }}>
            <Text fontSize="lg" fontWeight="600" color="gray.800" mb={1}>
              Informations générales
            </Text>

            <Text fontSize="sm" color="gray.500" mb={6}>
              Ces informations seront utilisées dans les documents, rapports et
              fiches de paie.
            </Text>

            <Grid
              templateColumns={{
                base: "1fr",
                md: "repeat(2, 1fr)",
              }}
              gap={5}
            >
              {/* Row 1 - Company name */}
              <GridItem>
                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight="600" color="gray.700">
                    Nom de l'entreprise
                  </FormLabel>

                  <Input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Nom de l'entreprise"
                    bg="white"
                    borderColor="gray.300"
                    _hover={{
                      borderColor: "gray.400",
                    }}
                    _focus={{
                      borderColor: "#F2B705",
                      boxShadow: "0 0 0 1px #F2B705",
                    }}
                  />
                </FormControl>
              </GridItem>

              {/* Row 1 - Legal name */}
              <GridItem>
                <FormControl>
                  <FormLabel fontSize="sm" fontWeight="600" color="gray.700">
                    Raison sociale
                  </FormLabel>

                  <Input
                    name="legalName"
                    value={form.legalName}
                    onChange={handleChange}
                    placeholder="Raison sociale"
                    bg="white"
                    borderColor="gray.300"
                    _hover={{
                      borderColor: "gray.400",
                    }}
                    _focus={{
                      borderColor: "#F2B705",
                      boxShadow: "0 0 0 1px #F2B705",
                    }}
                  />
                </FormControl>
              </GridItem>

              {/* Row 2 - Phone */}
              <GridItem>
                <FormControl>
                  <FormLabel fontSize="sm" fontWeight="600" color="gray.700">
                    Numéro de téléphone
                  </FormLabel>

                  <Input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+257 ..."
                    type="tel"
                    bg="white"
                    borderColor="gray.300"
                    _hover={{
                      borderColor: "gray.400",
                    }}
                    _focus={{
                      borderColor: "#F2B705",
                      boxShadow: "0 0 0 1px #F2B705",
                    }}
                  />
                </FormControl>
              </GridItem>

              {/* Row 2 - Email */}
              <GridItem>
                <FormControl>
                  <FormLabel fontSize="sm" fontWeight="600" color="gray.700">
                    Email
                  </FormLabel>

                  <Input
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="contact@entreprise.com"
                    type="email"
                    bg="white"
                    borderColor="gray.300"
                    _hover={{
                      borderColor: "gray.400",
                    }}
                    _focus={{
                      borderColor: "#F2B705",
                      boxShadow: "0 0 0 1px #F2B705",
                    }}
                  />
                </FormControl>
              </GridItem>

              {/* Row 3 - Address full width */}
              <GridItem
                colSpan={{
                  base: 1,
                  md: 2,
                }}
              >
                <FormControl>
                  <FormLabel fontSize="sm" fontWeight="600" color="gray.700">
                    Adresse
                  </FormLabel>

                  <Input
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    placeholder="Adresse de l'entreprise"
                    bg="white"
                    borderColor="gray.300"
                    _hover={{
                      borderColor: "gray.400",
                    }}
                    _focus={{
                      borderColor: "#F2B705",
                      boxShadow: "0 0 0 1px #F2B705",
                    }}
                  />
                </FormControl>
              </GridItem>

              {/* Row 4 - City */}
              <GridItem>
                <FormControl>
                  <FormLabel fontSize="sm" fontWeight="600" color="gray.700">
                    Ville
                  </FormLabel>

                  <Input
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    placeholder="Bujumbura"
                    bg="white"
                    borderColor="gray.300"
                    _hover={{
                      borderColor: "gray.400",
                    }}
                    _focus={{
                      borderColor: "#F2B705",
                      boxShadow: "0 0 0 1px #F2B705",
                    }}
                  />
                </FormControl>
              </GridItem>

              {/* Row 4 - Country */}
              <GridItem>
                <FormControl>
                  <FormLabel fontSize="sm" fontWeight="600" color="gray.700">
                    Pays
                  </FormLabel>

                  <Input
                    name="country"
                    value={form.country}
                    onChange={handleChange}
                    placeholder="Burundi"
                    bg="white"
                    borderColor="gray.300"
                    _hover={{
                      borderColor: "gray.400",
                    }}
                    _focus={{
                      borderColor: "#F2B705",
                      boxShadow: "0 0 0 1px #F2B705",
                    }}
                  />
                </FormControl>
              </GridItem>
            </Grid>
          </Box>

          <Divider />

          {/* Logo */}
          <Box p={{ base: 5, md: 7 }}>
            <Text fontSize="lg" fontWeight="600" color="gray.800" mb={1}>
              Logo de l'entreprise
            </Text>

            <Text fontSize="sm" color="gray.500" mb={6}>
              Le logo apparaîtra sur les rapports, fiches de paie et autres
              documents de l'entreprise.
            </Text>

            <Flex
              direction={{
                base: "column",
                sm: "row",
              }}
              align={{
                base: "flex-start",
                sm: "center",
              }}
              gap={5}
            >
              <Avatar
                size="xl"
                src={logoPreview || undefined}
                name={form.name}
                bg="gray.100"
                color="gray.600"
              />

              <Box>
                <Button
                  leftIcon={<FiCamera />}
                  onClick={handleLogoClick}
                  variant="outline"
                  borderColor="gray.300"
                  bg="white"
                  _hover={{
                    bg: "gray.50",
                    borderColor: "#F2B705",
                  }}
                >
                  Modifier le logo
                </Button>

                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  display="none"
                  onChange={handleLogoChange}
                />

                <Text mt={2} fontSize="xs" color="gray.500">
                  JPG, PNG ou WEBP — maximum 5 MB
                </Text>

                {logoFile && (
                  <Text mt={1} fontSize="xs" color="#9A7200" fontWeight="500">
                    Nouveau logo sélectionné : {logoFile.name}
                  </Text>
                )}
              </Box>
            </Flex>
          </Box>

          <Divider />

          {/* Footer */}
          <Flex justify="flex-end" p={{ base: 5, md: 6 }} bg="gray.50">
            <Button
              leftIcon={saving ? <Spinner size="sm" /> : <FiSave />}
              onClick={handleSave}
              isDisabled={saving}
              bg="#F2B705"
              color="white"
              px={6}
              _hover={{
                bg: "#D9A304",
              }}
              _active={{
                bg: "#C89400",
              }}
            >
              {saving ? "Enregistrement..." : "Enregistrer les modifications"}
            </Button>
          </Flex>
        </Box>
      </Box>
    </Box>
  );
};

export default CompanySettingsPage;
