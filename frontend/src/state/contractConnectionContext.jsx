import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  connectContracts,
  reconnectContractsFromAuthorizedWallet
} from "../services/bookingManagerService";
import { getEthereumProvider } from "../lib/ethereum";

const STORAGE_KEY = "parkfi.connection.requested";

const ContractConnectionContext = createContext(null);

export function ContractConnectionProvider({ children }) {
  const [connection, setConnection] = useState(null);
  const [status, setStatus] = useState("Disconnected");
  const [error, setError] = useState(null);

  const applyConnection = (nextConnection) => {
    setConnection(nextConnection);
    setStatus("Connected");
    setError(null);
  };

  const connect = async () => {
    setStatus("Connecting...");

    try {
      const nextConnection = await connectContracts();

      localStorage.setItem(STORAGE_KEY, "true");
      applyConnection(nextConnection);

      console.log("Contracts connected successfully", nextConnection);
    } catch (nextError) {
      setStatus("Connection failed");
      setError(nextError);
      throw nextError;
    }
  };

  useEffect(() => {
    let active = true;

    const reconnect = async () => {
      if (localStorage.getItem(STORAGE_KEY) !== "true") {
        return;
      }

      setStatus("Reconnecting...");

      try {
        const nextConnection = await reconnectContractsFromAuthorizedWallet();

        if (!active || !nextConnection) {
          if (active && !nextConnection) {
            setStatus("Disconnected");
          }
          return;
        }

        applyConnection(nextConnection);
      } catch (nextError) {
        if (!active) {
          return;
        }

        setStatus("Connection failed");
        setError(nextError);
      }
    };

    reconnect();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let ethereum;

    try {
      ethereum = getEthereumProvider();
    } catch {
      return undefined;
    }

    const handleAccountsChanged = (accounts) => {
      if (!accounts.length) {
        localStorage.removeItem(STORAGE_KEY);
        setConnection(null);
        setStatus("Disconnected");
        setError(null);
        return;
      }

      connect().catch(() => { });
    };

    const handleChainChanged = () => {
      connect().catch(() => { });
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener("accountsChanged", handleAccountsChanged);
      ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  const value = useMemo(
    () => ({
      account: connection?.account || null,
      chainId: connection?.chainId || null,
      connect,
      contractAddresses: connection?.contractAddresses || null,
      contracts: connection?.contracts || null,
      error,
      provider: connection?.provider || null,
      signer: connection?.signer || null,
      signerAddress: connection?.signerAddress || null,
      status
    }),
    [connection, error, status]
  );

  return (
    <ContractConnectionContext.Provider value={value}>
      {children}
    </ContractConnectionContext.Provider>
  );
}

export function useContractConnection() {
  const context = useContext(ContractConnectionContext);

  if (!context) {
    throw new Error("useContractConnection must be used within ContractConnectionProvider.");
  }

  return context;
}
