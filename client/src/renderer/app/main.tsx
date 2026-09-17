import { ChakraProvider } from "@chakra-ui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import router from "./routes";
import { queryClient } from "../lib/queryClient";
import NotificationListener from "../components/notifications/NotificationListener";
import NotificationCenter from "../components/notifications/NotificationCenter";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChakraProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <NotificationListener /> <NotificationCenter />
      </QueryClientProvider>
    </ChakraProvider>
  </StrictMode>
);
