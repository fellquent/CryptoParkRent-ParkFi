import { useContractConnection } from "../../state/contractConnectionContext";
import { WalletButton } from "./WalletButton";

export function ConnectionStatus() {
  const { account, balance, chainId, connect, contractAddresses, error, status } =
    useContractConnection();

  return (
    <section>
      <h2>Connection</h2>
      <p>Status: {status}</p>
      <p>Connected account: {account || "Not connected"}</p>
      <p>Chain ID: {chainId || "-"}</p>
      <p>Balance: {balance === null ? "-" : balance.toString()}</p>
      <p>BookingManager: {contractAddresses?.bookingManagerAddress || "-"}</p>
      <p>ParkingRegistry: {contractAddresses?.parkingRegistryAddress || "-"}</p>
      <p>ParkingPermitNFT: {contractAddresses?.parkingPermitNftAddress || "-"}</p>
      <WalletButton account={account} balance={balance} chainId={chainId} connect={connect} />
      {error ? <p>{error.message}</p> : null}
    </section>
  );
}
