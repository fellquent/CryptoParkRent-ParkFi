import { BrowserProvider } from "ethers";

export function getEthereumProvider() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask provider not found.");
  }

  return window.ethereum;
}

export async function requestWalletAccounts() {
  const ethereum = getEthereumProvider();

  return ethereum.request({
    method: "eth_requestAccounts"
  });
}

export async function getAuthorizedWalletAccounts() {
  const ethereum = getEthereumProvider();

  return ethereum.request({
    method: "eth_accounts"
  });
}

export async function createBrowserProvider() {
  const ethereum = getEthereumProvider();

  return new BrowserProvider(ethereum);
}
