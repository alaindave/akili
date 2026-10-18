import {
  Box,
  Button,
  Flex,
  FormControl,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { CiLock } from "react-icons/ci";
import { FaEye, FaEyeSlash, FaUnlockAlt } from "react-icons/fa";
import { IoIosMail } from "react-icons/io";
import { z } from "zod";
import useAdminUser from "../../../../store/auth.store";
import SignUp from "./SignUp";
import "../../../styles/App.css";
import { checkOnline } from "../../../services/connectivity_check.service";
import useTaskStore from "../../../../store/task.store";
import type { CompanySummary } from "../../../../common/types/shared/Company";
import { queryClient } from "../../../lib/queryClient";
import Logo from "../../../components/common/Logo";

const schema = z.object({
  email: z.string(),
  password: z.string(),
  companyId: z.string().optional(),
});

type AuthData = z.infer<typeof schema>;

const LoginPage = ({
  selectedCompany,
  onBack,
}: {
  selectedCompany: CompanySummary | null;
  onBack?: () => void;
}) => {
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const navigate = useNavigate();
  const setLogIn = useAdminUser((store) => store.login);
  const clearTasks = useTaskStore((store) => store.clearTasks);
  const loadTopTasks = useTaskStore((store) => store.loadTopTasks);

  const { register, handleSubmit } = useForm<AuthData>({
    resolver: zodResolver(schema),
  });

  const handleLogin = async (credentials: AuthData) => {
    setIsLoggingIn(true);
    setErrorMessage("");

    try {
      await clearTasks();

      const loginCredentials = {
        ...credentials,
        companyId:
          selectedCompany?.companyId ||
          credentials.companyId?.trim() ||
          undefined,
      };

      const online = await checkOnline();
      console.log("ONLINE:", online);

      if (!online) {
        const offlineUser = await window.electron.auth.offlineUsers.login({
          ...loginCredentials,
        });

        if (!offlineUser) {
          throw new Error("OFFLINE LOGIN FAILED");
        }

        if (
          selectedCompany &&
          offlineUser.companyId !== selectedCompany.companyId
        ) {
          await window.electron.auth.auth.logout();
          setErrorMessage(
            "Ce compte ne correspond pas à l’entreprise sélectionnée."
          );
          return;
        }

        queryClient.clear();

        setLogIn({
          companyId: offlineUser.companyId,
          _id: offlineUser._id,
          firstName: offlineUser.firstName,
          lastName: offlineUser.lastName,
          email: offlineUser.email,
          role: offlineUser.role,
          notes: offlineUser.notes ?? "",
        });

        await loadTopTasks(offlineUser.companyId, offlineUser._id, "HR");

        navigate("/admin", { replace: true });
        return;
      }

      const adminUser = await window.electron.auth.auth.login(loginCredentials);

      if (adminUser) {
        if (
          selectedCompany &&
          adminUser.company.companyId !== selectedCompany.companyId
        ) {
          await window.electron.auth.auth.logout();
          setErrorMessage(
            "Ce compte ne correspond pas à l’entreprise sélectionnée."
          );
          return;
        }

        await window.electron.auth.offlineUsers.save(
          adminUser.company.companyId,
          {
            companyId: adminUser.company.companyId,
            _id: adminUser.admin._id,
            email: adminUser.admin.email,
            password: credentials.password,
            firstName: adminUser.admin.firstName,
            lastName: adminUser.admin.lastName,
            role: adminUser.admin.role,
            notes: adminUser.admin.notes,
          }
        );

        queryClient.clear();

        setLogIn({
          companyId: adminUser.company.companyId,
          _id: adminUser.admin._id,
          firstName: adminUser.admin.firstName,
          lastName: adminUser.admin.lastName,
          email: adminUser.admin.email,
          role: adminUser.admin.role,
          notes: adminUser.admin.notes,
        });

        await loadTopTasks(
          adminUser.company.companyId,
          adminUser.admin._id,
          "HR"
        );

        navigate("/admin", { replace: true });
      }
    } catch (error) {
      console.error("LOGIN FAILED:", error);
      setErrorMessage("Email et/ou mot de passe incorrect.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleChange = () => {
    setErrorMessage("");
  };

  return (
    <Flex
      w="100%"
      h="100vh"
      height="100dvh"
      minH={0}
      minW={0}
      align="center"
      justify="center"
      overflow="hidden"
      boxSizing="border-box"
      px={{ base: 3, sm: 4, md: 8 }}
      py="1.5rem"
    >
      <Box
        position="relative"
        flex="0 1 460px"
        w="100%"
        minW={0}
        maxW="460px"
        maxH="calc(100dvh - 3rem)"
        overflow="hidden"
        boxSizing="border-box"
        bg="white"
        border="1px solid"
        borderColor="#D1D5DB"
        borderRadius={{ base: "14px", md: "18px" }}
        boxShadow="0 6px 20px rgba(0,0,0,0.12)"
        p="clamp(1rem, 4vh, 2.5rem)"
      >
        <form
          noValidate
          onSubmit={handleSubmit(handleLogin)}
          onChange={handleChange}
        >
          <VStack
            align="center"
            w="100%"
            spacing="clamp(0.5rem, 2.5vh, 1.5rem)"
          >
            <Box flexShrink={0} lineHeight={0}>
              <Logo
                companyId={selectedCompany?.companyId}
                showCompanyName={false}
                width="clamp(3.5rem, 13vh, 6.5rem)"
                height="clamp(3.5rem, 13vh, 6.5rem)"
                isDisabled
              />
            </Box>

            <Text
              textAlign="center"
              fontSize="clamp(1.2rem, 3.2vh, 1.6rem)"
              fontWeight="700"
              lineHeight="1.2"
              color="#1F2937"
            >
              Connexion
            </Text>

            <FormControl w="100%">
              <InputGroup>
                <InputLeftElement
                  pointerEvents="none"
                  h="clamp(44px, 6vh, 52px)"
                  w="42px"
                >
                  <IoIosMail size="20px" color="#5B6472" />
                </InputLeftElement>

                <Input
                  type="email"
                  placeholder="Email"
                  autoComplete="username"
                  h="clamp(44px, 6vh, 52px)"
                  pl="42px"
                  bg="#F9FAFB"
                  border="1px solid"
                  borderColor="#B8C2CC"
                  color="#1F2937"
                  _placeholder={{ color: "#6B7280" }}
                  _hover={{ borderColor: "#0078D4" }}
                  _focus={{
                    borderColor: "#0078D4",
                    boxShadow: "0 0 0 1px #0078D4",
                  }}
                  {...register("email")}
                />
              </InputGroup>
            </FormControl>

            <FormControl w="100%">
              <InputGroup>
                <InputLeftElement
                  pointerEvents="none"
                  h="clamp(44px, 6vh, 52px)"
                  w="42px"
                >
                  <FaUnlockAlt size="16px" color="#5B6472" />
                </InputLeftElement>

                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mot de passe"
                  autoComplete="current-password"
                  h="clamp(44px, 6vh, 52px)"
                  pl="42px"
                  pr="48px"
                  bg="#F9FAFB"
                  border="1px solid"
                  borderColor="#B8C2CC"
                  color="#1F2937"
                  _placeholder={{ color: "#6B7280" }}
                  _hover={{ borderColor: "#B8C2CC" }}
                  _focus={{
                    borderColor: "#0078D4",
                    boxShadow: "0 0 0 1px #0078D4",
                  }}
                  {...register("password")}
                />

                <InputRightElement w="48px" h="clamp(44px, 6vh, 52px)">
                  <IconButton
                    type="button"
                    aria-label={
                      showPassword
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                    icon={showPassword ? <FaEyeSlash /> : <FaEye />}
                    variant="ghost"
                    size="sm"
                    color="#5B6472"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setShowPassword((visible) => !visible)}
                  />
                </InputRightElement>
              </InputGroup>

              {errorMessage && (
                <Text
                  mt="0.5rem"
                  color="#D13438"
                  fontSize="clamp(0.75rem, 1.7vh, 1rem)"
                  fontWeight="500"
                  textAlign="center"
                  lineHeight="1.3"
                  overflowWrap="anywhere"
                >
                  {errorMessage}
                </Text>
              )}
            </FormControl>

            <Button
              type="submit"
              w="100%"
              minW={0}
              h="clamp(44px, 6.5vh, 56px)"
              minH="44px"
              flexShrink={0}
              bg="#0078D4"
              color="white"
              fontSize="clamp(0.9rem, 2.2vh, 1.1rem)"
              fontWeight="600"
              leftIcon={<CiLock size={22} />}
              isLoading={isLoggingIn}
              loadingText="Connexion..."
              isDisabled={isLoggingIn}
              _hover={{ bg: "#106EBE" }}
              _active={{ bg: "#005A9E" }}
            >
              Se connecter
            </Button>

            <Text
              fontSize="clamp(0.85rem, 2.2vh, 1.1rem)"
              lineHeight="1.2"
              textAlign="center"
              color="#1F2937"
            >
              ou
            </Text>

            <Flex w="100%" justify="center" minW={0} flexShrink={0}>
              <SignUp selectedCompany={selectedCompany?.companyId} />
            </Flex>
          </VStack>
        </form>

        {selectedCompany && (
          <Text
            onClick={onBack}
            cursor={onBack ? "pointer" : "default"}
            position="absolute"
            bottom="0.5rem"
            right="1rem"
            maxW="calc(100% - 2rem)"
            fontSize="clamp(0.7rem, 1.6vh, 0.85rem)"
            color="#1E3A5F"
            fontWeight="semibold"
            noOfLines={1}
          >
            {selectedCompany.name}
          </Text>
        )}
      </Box>
    </Flex>
  );
};

export default LoginPage;
