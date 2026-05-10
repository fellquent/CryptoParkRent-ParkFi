import { useEffect, useState } from "react";
import { EXPECTED_CHAIN_ID } from "../../config/contracts";
import { formatEthValue, shortenAddress } from "../../utils/formatters";

function isZeroBalance(balance) {
  try {
    return balance !== null && balance !== undefined && BigInt(balance) === 0n;
  } catch {
    return false;
  }
}

export function WalletButton({ account, balance = null, chainId = null, connect }) {
  const [errorMessage, setErrorMessage] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (account) {
      setErrorMessage("");
    }
  }, [account]);

  const handleConnect = async () => {
    setErrorMessage("");
    setIsConnecting(true);

    try {
      await connect();
    } catch (error) {
      setErrorMessage(error?.message || "Wallet connection failed.");
    } finally {
      setIsConnecting(false);
    }
  };

  const label = account
    ? shortenAddress(account)
    : isConnecting
      ? "Connecting..."
      : "Connect Wallet";
  const balanceLabel =
    account && balance !== null ? `${formatEthValue(balance, "0")} ETH` : null;
  const isWrongNetwork = account && EXPECTED_CHAIN_ID && chainId !== EXPECTED_CHAIN_ID;
  const hasNoBalance = account && isZeroBalance(balance);

  return (
    <div className="wallet-control">
      <button
        className={`button wallet-button ${account ? "is-connected" : "is-disconnected"}`}
        disabled={isConnecting}
        type="button"
        onClick={handleConnect}
      >
        {label}
      </button>
      {account ? (
        <span className="wallet-meta">
          Chain {chainId || "-"}
          {balanceLabel ? ` - ${balanceLabel}` : ""}
        </span>
      ) : null}
      {isWrongNetwork ? (
        <span className="wallet-error" role="status">
          Switch to chain {EXPECTED_CHAIN_ID}
        </span>
      ) : null}
      {hasNoBalance ? (
        <span className="wallet-error" role="status">
          This account has 0 ETH on this network.
        </span>
      ) : null}
      {errorMessage ? (
        <span className="wallet-error" role="status">
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
}
