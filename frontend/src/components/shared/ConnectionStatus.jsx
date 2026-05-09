import { useContractConnection } from "../../state/contractConnectionContext";

export function ConnectionStatus() {
  const { account, chainId, connect, contractAddresses, error, status } =
    useContractConnection();

  return (
    <section>
      <h2>Connection</h2>
      <p>Status: {status}</p>
      <p>Connected account: {account || "Not connected"}</p>
      <p>Chain ID: {chainId || "-"}</p>
      <p>BookingManager: {contractAddresses?.bookingManagerAddress || "-"}</p>
      <p>ParkingRegistry: {contractAddresses?.parkingRegistryAddress || "-"}</p>
      <p>ParkingPermitNFT: {contractAddresses?.parkingPermitNftAddress || "-"}</p>
      <button type="button" onClick={connect}>
        Connect MetaMask
      </button>
      {error ? <p>{error.message}</p> : null}
    </section>
  );
}
