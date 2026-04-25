import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

const mezoChain = defineChain({
  id: Number(import.meta.env.VITE_CHAIN_ID ?? 31612),
  name: import.meta.env.VITE_CHAIN_NAME ?? "Mezo Mainnet",
  nativeCurrency: {
    name: import.meta.env.VITE_NATIVE_CURRENCY_NAME ?? "Bitcoin",
    symbol: import.meta.env.VITE_NATIVE_CURRENCY_SYMBOL ?? "BTC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [
        import.meta.env.VITE_RPC_URL ?? "https://rpc-http.mezo.boar.network",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: import.meta.env.VITE_EXPLORER_NAME ?? "Explorer",
      url: import.meta.env.VITE_EXPLORER_URL ?? "https://explorer.mezo.org",
    },
  },
});

const config = createConfig({
  chains: [mezoChain],
  connectors: [
    injected({
      shimDisconnect: true,
      unstable_shimAsyncInject: 2_000,
    }),
  ],
  transports: {
    [mezoChain.id]: http(),
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
