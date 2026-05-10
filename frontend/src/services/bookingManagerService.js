import {
  createBrowserProvider,
  getAuthorizedWalletAccounts,
  requestWalletAccounts,
  switchToExpectedChain
} from "../lib/ethereum";
import { BOOKING_MANAGER_ADDRESS, EXPECTED_CHAIN_ID } from "../config/contracts";
import { createBookingManagerContract } from "../contracts/bookingManager";
import { createParkingPermitNftContract } from "../contracts/parkingPermitNft";
import { createParkingRegistryContract } from "../contracts/parkingRegistry";

async function resolveContractAddresses(bookingManagerContract) {
  try {
    const registryAddress = await bookingManagerContract.registry();
    const parkingPermitNftAddress = await bookingManagerContract.permitNFT();

    return {
      bookingManagerAddress: BOOKING_MANAGER_ADDRESS,
      parkingPermitNftAddress,
      parkingRegistryAddress: registryAddress
    };
  } catch (error) {
    throw new Error(
      `Unable to read BookingManager at ${BOOKING_MANAGER_ADDRESS}. ` +
        "Redeploy the contracts, update frontend/.env.local, restart Vite, and switch MetaMask to the deployment network.",
      { cause: error }
    );
  }
}

function assertExpectedChain(chainId) {
  if (EXPECTED_CHAIN_ID && chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(
      `Wrong network. Switch MetaMask to Hardhat chain ID ${EXPECTED_CHAIN_ID}. Current chain ID: ${chainId}.`
    );
  }
}

async function assertContractCode(provider, address, label, chainId) {
  const code = await provider.getCode(address);

  if (code === "0x") {
    throw new Error(
      `${label} is not deployed at ${address} on chain ID ${chainId}. ` +
        "Switch MetaMask to the network used for deployment, or redeploy and update frontend/.env.local."
    );
  }
}

export async function connectContracts() {
  const [account] = await requestWalletAccounts();

  await switchToExpectedChain();

  return buildContractsConnection(account);
}

export async function reconnectContractsFromAuthorizedWallet() {
  const [account] = await getAuthorizedWalletAccounts();

  if (!account) {
    return null;
  }

  return buildContractsConnection(account);
}

async function buildContractsConnection(account) {
  const provider = await createBrowserProvider();
  const signer = await provider.getSigner(account);
  const network = await provider.getNetwork();
  const chainId = network.chainId.toString();

  assertExpectedChain(chainId);
  await assertContractCode(provider, BOOKING_MANAGER_ADDRESS, "BookingManager", chainId);

  const signerAddress = await signer.getAddress();

  const bookingManager = createBookingManagerContract(signer);
  const addresses = await resolveContractAddresses(bookingManager);

  await Promise.all([
    assertContractCode(
      provider,
      addresses.parkingRegistryAddress,
      "ParkingRegistry",
      chainId
    ),
    assertContractCode(
      provider,
      addresses.parkingPermitNftAddress,
      "ParkingPermitNFT",
      chainId
    )
  ]);

  const parkingRegistry = createParkingRegistryContract(
    addresses.parkingRegistryAddress,
    signer
  );

  const parkingPermitNft = createParkingPermitNftContract(
    addresses.parkingPermitNftAddress,
    signer
  );

  return {
    account,
    balance: await provider.getBalance(account),
    chainId,
    contractAddresses: addresses,
    contracts: {
      bookingManager,
      parkingPermitNft,
      parkingRegistry
    },
    provider,
    signer,
    signerAddress
  };
}
