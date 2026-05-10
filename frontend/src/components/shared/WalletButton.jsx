export function WalletButton({ account, connect }) {
  return (
    <button
      className={`button wallet-button ${account ? "is-connected" : "is-disconnected"}`}
      type="button"
      onClick={connect}
    >
      {account ? "Connected" : "Disconnected"}
    </button>
  );
}
