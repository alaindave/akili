import {
  Box,
  Button,
  Flex,
  FormControl,
  Image,
  Input,
  InputGroup,
  InputLeftElement,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { CiLock } from "react-icons/ci";
import { FaUnlockAlt } from "react-icons/fa";
import { IoIosMail } from "react-icons/io";
import { z } from "zod";
import useAdminUser from "../../../../store/auth.store";
import logo from "../../../assets/afritan_logo.png";
import SignUp from "./SignUp";
import "../../../styles/App.css";
import { checkOnline } from "../../../services/connectivity_check.service";
import useTaskStore from "../../../../store/task.store";

const schema = z.object({
  email: z.string(),
  password: z.string(),
});

type AuthData = z.infer<typeof schema>;

const LoginPage = () => {
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  const setLogIn = useAdminUser((store) => store.login);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const clearTasks = useTaskStore((store) => store.clearTasks);
  const loadTopTasks = useTaskStore((store) => store.loadTopTasks);

  const { register, handleSubmit } = useForm<AuthData>({
    resolver: zodResolver(schema),
  });

  const handleLogin = async (credentials: AuthData) => {
    setIsLoggingIn(true);
    await clearTasks();

    try {
      const online = await checkOnline();
      console.log("ONLINE:", online);

      if (!online) {
        const offlineUser = await window.electron.offlineUsers.login({
          email: credentials.email,
          password: credentials.password,
        });

        if (!offlineUser) {
          throw new Error("OFFLINE LOGIN FAILED");
        }

        console.log("OFFLINE LOGIN SUCCESS: ", offlineUser);

        setLogIn({
          companyId: offlineUser.company.companyId,
          _id: offlineUser.admin._id,
          firstName: offlineUser.admin.firstName,
          lastName: offlineUser.admin.lastName,
          email: offlineUser.admin.email,
          role: offlineUser.admin.role,
          notes: offlineUser.admin.notes ?? "",
        });

        await loadTopTasks(offlineUser.admin._id);
        navigate("/admin", { replace: true });

        return;
      }

      const adminUser = await window.electron.auth.login(credentials);

      console.log("ADMIN USER AFTER LOGIN", adminUser);

      console.log("CREDS:", credentials);

      if (adminUser) {
        const offlineUser = await window.electron.offlineUsers.save({
          companyId: adminUser.company.companyId,
          _id: adminUser.admin._id,
          email: adminUser.admin.email,
          password: credentials.password,
          firstName: adminUser.admin.firstName,
          lastName: adminUser.admin.lastName,
          role: adminUser.admin.role,
          notes: adminUser.admin.notes,
        });

        console.log("OFFLINE USER SUCCESSFULLY SAVED: ", offlineUser);

        setLogIn({
          companyId: adminUser.admin.companyId,
          _id: adminUser.admin._id,
          firstName: adminUser.admin.firstName,
          lastName: adminUser.admin.lastName,
          email: adminUser.admin.email,
          role: adminUser.admin.role,
          notes: adminUser.admin.notes ?? "",
        });

        await loadTopTasks(adminUser.admin._id);
        navigate("/admin", { replace: true });
      }
    } catch (error) {
      console.log("LOGIN FAILED: ", error);
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
      minH="100%"
      justify="center"
      align="center"
      px={{ base: 4, sm: 6, md: 8 }}
      py={{ base: 4, md: 6 }}
    >
      <Box
        w="100%"
        maxW="460px"
        bg="white"
        border="1px solid"
        borderColor="#D1D5DB"
        borderRadius={{
          base: "14px",
          md: "18px",
        }}
        boxShadow="0 6px 20px rgba(0,0,0,0.12)"
        p={{
          base: 6,
          sm: 8,
          md: 10,
        }}
      >
        <form
          noValidate
          onSubmit={handleSubmit(handleLogin)}
          onChange={handleChange}
        >
          <VStack
            spacing={{
              base: 4,
              sm: 5,
              md: 6,
            }}
            align="stretch"
          >
            <Image
              src={logo}
              boxSize={{
                base: "5.5rem",
                sm: "6.5rem",
                md: "7.3rem",
              }}
              objectFit="contain"
              mx="auto"
            />

            <Text
              textAlign="center"
              fontSize={{
                base: "1.4rem",
                sm: "1.5rem",
                md: "1.6rem",
              }}
              fontWeight="700"
              color="#1F2937"
            >
              Connexion
            </Text>

            <FormControl>
              <InputGroup>
                <InputLeftElement
                  pointerEvents="none"
                  h={{
                    base: "48px",
                    md: "52px",
                  }}
                >
                  <IoIosMail size="20px" color="#5B6472" />
                </InputLeftElement>

                <Input
                  type="email"
                  placeholder="Email"
                  h={{
                    base: "48px",
                    md: "52px",
                  }}
                  pl="42px"
                  bg="#F9FAFB"
                  border="1px solid"
                  borderColor="#B8C2CC"
                  color="#1F2937"
                  _placeholder={{
                    color: "#6B7280",
                  }}
                  _hover={{
                    borderColor: "#0078D4",
                  }}
                  _focus={{
                    borderColor: "#0078D4",
                    boxShadow: "0 0 0 1px #0078D4",
                  }}
                  {...register("email")}
                />
              </InputGroup>
            </FormControl>

            <FormControl>
              <InputGroup>
                <InputLeftElement
                  pointerEvents="none"
                  h={{
                    base: "48px",
                    md: "52px",
                  }}
                >
                  <FaUnlockAlt size="16px" color="#5B6472" />
                </InputLeftElement>

                <Input
                  type="password"
                  placeholder="Mot de passe"
                  h={{
                    base: "48px",
                    md: "52px",
                  }}
                  pl="42px"
                  bg="#F9FAFB"
                  border="1px solid"
                  borderColor="#B8C2CC"
                  color="#1F2937"
                  _placeholder={{
                    color: "#6B7280",
                  }}
                  _hover={{
                    borderColor: "#B8C2CC",
                  }}
                  _focus={{
                    borderColor: "#0078D4",
                    boxShadow: "0 0 0 1px #0078D4",
                  }}
                  {...register("password")}
                />
              </InputGroup>

              {errorMessage && (
                <Text
                  mt={3}
                  color="#D13438"
                  fontSize={{
                    base: "0.875rem",
                    md: "1rem",
                  }}
                  fontWeight="500"
                  textAlign="center"
                >
                  {errorMessage}
                </Text>
              )}
            </FormControl>

            <Button
              type="submit"
              w="100%"
              h={{
                base: "50px",
                md: "56px",
              }}
              bg="#0078D4"
              mt={{
                base: 2,
                md: 4,
              }}
              color="white"
              fontSize={{
                base: "1rem",
                md: "1.1rem",
              }}
              fontWeight="600"
              leftIcon={<CiLock size={22} />}
              isLoading={isLoggingIn}
              loadingText="Connexion..."
              isDisabled={isLoggingIn}
              _hover={{
                bg: "#106EBE",
              }}
              _active={{
                bg: "#005A9E",
              }}
            >
              Se connecter
            </Button>

            <Text
              fontSize={{
                base: "1rem",
                md: "1.1rem",
              }}
              textAlign="center"
              color="#1F2937"
            >
              ou
            </Text>

            <Flex justify="center">
              <SignUp />
            </Flex>
          </VStack>
        </form>
      </Box>
    </Flex>
  );
};

export default LoginPage;
