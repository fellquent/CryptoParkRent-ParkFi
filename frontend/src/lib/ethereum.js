import { BrowserProvider } from "ethers";
import {
  EXPECTED_CHAIN_CURRENCY,
  EXPECTED_CHAIN_ID,
  EXPECTED_CHAIN_NAME,
  EXPECTED_CHAIN_RPC_URL
} from "../config/contracts";

function chainIdToHex(chainId) {
  return `0x${BigInt(chainId).toString(16)}`;
}

export function getEthereumProvider() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask is not installed. Install MetaMask, then refresh this page.");
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

export async function switchToExpectedChain() {
  if (!EXPECTED_CHAIN_ID) {
    return false;
  }

  const ethereum = getEthereumProvider();
  const targetChainId = chainIdToHex(EXPECTED_CHAIN_ID);
  const currentChainId = await ethereum.request({ method: "eth_chainId" });

  if (currentChainId?.toLowerCase() === targetChainId.toLowerCase()) {
    return false;
  }

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetChainId }]
    });
  } catch (error) {
    if (error?.code !== 4902 || !EXPECTED_CHAIN_RPC_URL) {
      throw error;
    }

    await ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: targetChainId,
          chainName: EXPECTED_CHAIN_NAME,
          nativeCurrency: {
            decimals: 18,
            name: EXPECTED_CHAIN_CURRENCY,
            symbol: EXPECTED_CHAIN_CURRENCY
          },
          rpcUrls: [EXPECTED_CHAIN_RPC_URL]
        }
      ]
    });
  }

  return true;
}
