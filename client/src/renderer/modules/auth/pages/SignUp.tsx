import {
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
  useDisclosure,
  Image,
  SimpleGrid,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useForm } from "react-hook-form";
import useAdminUser from "../../../../store/auth.store";
import { MdAlternateEmail, MdPerson2, MdBusiness } from "react-icons/md";
import { FaSave } from "react-icons/fa";
import { RxCrossCircled } from "react-icons/rx";
import { RiLockPasswordFill } from "react-icons/ri";
import logo from "../../../assets/afritan_logo.png";
import { useState } from "react";

const schema = z
  .object({
    firstName: z.string().min(3, { message: "Minimum de 3 caractères requis" }),
    lastName: z.string().min(3, { message: "Minimum de 3 caractères requis" }),
    email: z.string().email("Addresse email non valide."),
    signUpCode: z.string(),
    password: z
      .string()
      .min(8, { message: "Minimum de 8 caractères requis" })
      .regex(/[a-z]/, "Incluez au moins une lettre minuscule.")
      .regex(/[A-Z]/, "Incluez au moins une lettre majuscule.")
      .regex(/[0-9]/, "Incluez au moins un chiffre."),
    confirmPassword: z.string(),
  })
  .superRefine(({ confirmPassword, password }, ctx) => {
    if (confirmPassword !== password) {
      ctx.addIssue({
        code: "custom",
        message: "Mots de passe non identiques.",
        path: ["confirmPassword"],
      });
    }
  });

type SignUpData = z.infer<typeof schema>;

const labelColor = "#374151";

const inputStyle = {
  w: "100%",
  bg: "#F9FAFB",
  color: "#1F2937",
  border: "1px solid",
  borderColor: "#B8C2CC",
  borderRadius: "6px",
  h: {
    base: "46px",
    md: "48px",
  },
  _placeholder: {
    color: "#6B7280",
  },
  _hover: {
    borderColor: "#0078D4",
  },
  _focus: {
    borderColor: "#0078D4",
    boxShadow: "0 0 0 1px #0078D4",
  },
};

const SignUp = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const navigate = useNavigate();

  const setAuth = useAdminUser((store) => store.login);

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: SignUpData) => {
    setIsLoggingIn(true);
    setErrorMessage("");

    console.log("FORM SUBMITTED:", data);

    try {
      const res = await window.electron.auth.sign_up({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        signUpCode: data.signUpCode,
      });

      console.log("USER SIGN UP SUCCESS: ", res);

      setAuth({
        _id: res.admin._id,
        companyId: res.company.companyId,
        firstName: res.admin.firstName,
        lastName: res.admin.lastName,
        email: res.admin.email,
        role: res.admin.role,
        notes: res.admin.notes ?? "",
      });

      navigate("/admin");
    } catch (error) {
      console.error("AN ERROR OCCURED WHILE SIGNING UP", error);
      setErrorMessage("Une erreur est survenue. Veuillez contacter ADB Tech.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        borderColor="#0078D4"
        color="#0078D4"
        size="md"
        fontWeight="600"
        onClick={onOpen}
        _hover={{
          bg: "#F3F9FF",
          borderColor: "#106EBE",
          color: "#106EBE",
        }}
      >
        <Text fontSize="1rem">Créer un compte</Text>
      </Button>

      <Modal
        size={{
          base: "full",
          sm: "lg",
          md: "2xl",
          lg: "3xl",
        }}
        isOpen={isOpen}
        onClose={onClose}
        isCentered
        scrollBehavior="inside"
      >
        <ModalOverlay backdropFilter="auto" backdropBlur="6px" />

        <ModalContent
          mx={{
            base: 2,
            sm: 4,
          }}
          my={{
            base: 2,
            sm: 4,
          }}
          bg="#FFFFFF"
          border="1px solid"
          borderColor="#D1D9E0"
          borderRadius={{
            base: "10px",
            md: "12px",
          }}
          boxShadow="0 12px 40px rgba(0,0,0,0.15)"
          maxH="calc(100vh - 24px)"
          overflow="hidden"
        >
          <form noValidate onSubmit={handleSubmit(onSubmit)}>
            {/* HEADER */}
            <ModalHeader
              color="#1F2937"
              px={{
                base: 5,
                md: 8,
              }}
              pt={{
                base: 5,
                md: 7,
              }}
              pb={{
                base: 4,
                md: 5,
              }}
            >
              <HStack
                justify="center"
                spacing={{
                  base: 3,
                  md: 4,
                }}
                pr={8}
              >
                <Image
                  src={logo}
                  boxSize={{
                    base: "3.8rem",
                    md: "4.8rem",
                  }}
                  objectFit="contain"
                  borderRadius="12px"
                  flexShrink={0}
                />

                <VStack align="start" spacing={0}>
                  <Text
                    fontSize={{
                      base: "1.2rem",
                      sm: "1.35rem",
                      md: "1.5rem",
                    }}
                    fontWeight="600"
                    lineHeight="1.3"
                  >
                    Créer un compte admin
                  </Text>

                  <Text
                    color="#6B7280"
                    fontSize={{
                      base: "0.8rem",
                      md: "0.9rem",
                    }}
                    mt={1}
                  >
                    Remplissez le formulaire
                  </Text>
                </VStack>
              </HStack>
            </ModalHeader>

            <ModalCloseButton
              color="#6B7280"
              top={{
                base: 3,
                md: 4,
              }}
              right={{
                base: 3,
                md: 4,
              }}
              _hover={{
                bg: "#F3F4F6",
              }}
            />

            {/* BODY */}
            <ModalBody
              px={{
                base: 5,
                md: 8,
              }}
              py={{
                base: 3,
                md: 4,
              }}
            >
              <FormControl>
                <SimpleGrid
                  columns={{
                    base: 1,
                    md: 2,
                  }}
                  spacing={{
                    base: 4,
                    md: 5,
                  }}
                >
                  {/* LAST NAME */}
                  <FormField
                    icon={<MdPerson2 color="#F2B705" size="1.3rem" />}
                    label="Nom"
                    error={errors.lastName?.message}
                  >
                    <Input
                      {...inputStyle}
                      type="text"
                      {...register("lastName")}
                    />
                  </FormField>

                  {/* FIRST NAME */}
                  <FormField
                    icon={<MdPerson2 color="#F2B705" size="1.3rem" />}
                    label="Prénom"
                    error={errors.firstName?.message}
                  >
                    <Input
                      {...inputStyle}
                      type="text"
                      {...register("firstName")}
                    />
                  </FormField>

                  {/* EMAIL */}
                  <FormField
                    icon={<MdAlternateEmail color="#F2B705" size="1.3rem" />}
                    label="Email"
                    error={errors.email?.message}
                  >
                    <Input
                      {...inputStyle}
                      type="email"
                      {...register("email")}
                    />
                  </FormField>

                  {/* Sign up code*/}
                  <FormField
                    icon={<MdBusiness color="#F2B705" size="1.3rem" />}
                    label="Code d'acces"
                  >
                    <Input
                      {...inputStyle}
                      type="text"
                      {...register("signUpCode")}
                    />
                  </FormField>

                  {/* PASSWORD */}
                  <FormField
                    icon={<RiLockPasswordFill color="#F2B705" size="1.3rem" />}
                    label="Mot de passe"
                    error={errors.password?.message}
                  >
                    <Input
                      {...inputStyle}
                      type="password"
                      placeholder="Min. 8 car. avec 1 chiffre et 1 lettre maj"
                      {...register("password")}
                    />
                  </FormField>

                  {/* CONFIRM PASSWORD */}
                  <FormField
                    icon={<RiLockPasswordFill color="#F2B705" size="1.3rem" />}
                    label="Confirmez le mot de passe"
                    error={errors.confirmPassword?.message}
                  >
                    <Input
                      {...inputStyle}
                      type="password"
                      placeholder="Min. 8 car. avec 1 chiffre et 1 lettre maj"
                      {...register("confirmPassword")}
                    />
                  </FormField>
                </SimpleGrid>

                {errorMessage && (
                  <Text
                    mt={4}
                    textAlign="center"
                    fontSize={{
                      base: "0.85rem",
                      md: "0.95rem",
                    }}
                    fontWeight="600"
                    color="red.600"
                  >
                    {errorMessage}
                  </Text>
                )}
              </FormControl>
            </ModalBody>

            {/* FOOTER */}
            <ModalFooter
              px={{
                base: 5,
                md: 8,
              }}
              py={{
                base: 4,
                md: 5,
              }}
              bg="#FFFFFF"
              borderTop="1px solid"
              borderColor="#EDF0F2"
            >
              <HStack w="100%" justify="flex-end" spacing={3} flexWrap="wrap">
                {/* CANCEL */}
                <Button
                  borderRadius="8px"
                  bg="#08162b"
                  color="#FFFFFF"
                  borderWidth="0.5px"
                  borderColor="#08162b"
                  onClick={onClose}
                  leftIcon={<RxCrossCircled color="#FFFFFF" size="18px" />}
                  h={{
                    base: "42px",
                    md: "44px",
                  }}
                  px={{
                    base: 4,
                    md: 5,
                  }}
                  _hover={{
                    bg: "#14243D",
                  }}
                >
                  Annuler
                </Button>

                {/* SUBMIT */}
                <Button
                  type="submit"
                  borderRadius="8px"
                  bg="#F2B705"
                  color="black"
                  borderWidth="0.5px"
                  borderColor="#D49F00"
                  isLoading={isLoggingIn}
                  loadingText="Création..."
                  spinnerPlacement="start"
                  isDisabled={isLoggingIn}
                  leftIcon={<FaSave />}
                  h={{
                    base: "42px",
                    md: "44px",
                  }}
                  px={{
                    base: 4,
                    md: 5,
                  }}
                  _hover={{
                    bg: "#DFA900",
                  }}
                >
                  Créer
                </Button>
              </HStack>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
};

type FormFieldProps = {
  icon: React.ReactNode;
  label: string;
  error?: string;
  children: React.ReactNode;
};

const FormField = ({ icon, label, error, children }: FormFieldProps) => {
  return (
    <Box minW={0}>
      <HStack spacing={2} mb={2} align="center">
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          {icon}
        </Box>

        <FormLabel
          color={labelColor}
          fontWeight="600"
          mb={0}
          fontSize={{
            base: "0.9rem",
            md: "0.95rem",
          }}
        >
          {label}
        </FormLabel>
      </HStack>

      {children}

      <Box
        minH={{
          base: "18px",
          md: "20px",
        }}
        mt={1}
      >
        {error && (
          <Text color="red.500" fontSize="0.75rem" lineHeight="1.2">
            {error}
          </Text>
        )}
      </Box>
    </Box>
  );
};

export default SignUp;
