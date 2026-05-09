import { ContractConnectionProvider } from "../state/contractConnectionContext";

export function AppProviders({ children }) {
  return (
    <ContractConnectionProvider>
      {children}
    </ContractConnectionProvider>
  );
}
