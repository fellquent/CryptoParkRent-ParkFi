import {
  createBrowserProvider,
  getAuthorizedWalletAccounts,
  requestWalletAccounts
} from "../lib/ethereum";
import { BOOKING_MANAGER_ADDRESS } from "../config/contracts";
import { createBookingManagerContract } from "../contracts/bookingManager";
import { createParkingPermitNftContract } from "../contracts/parkingPermitNft";
import { createParkingRegistryContract } from "../contracts/parkingRegistry";

async function resolveContractAddresses(bookingManagerContract) {
  const registryAddress = await bookingManagerContract.registry();

  const parkingPermitNftAddress = await bookingManagerContract.permitNFT();

  return {
    bookingManagerAddress: BOOKING_MANAGER_ADDRESS,
    parkingPermitNftAddress,
    parkingRegistryAddress: registryAddress
  };
}

export async function connectContracts() {
  const [account] = await requestWalletAccounts();

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
  const signerAddress = await signer.getAddress();

  const bookingManager = createBookingManagerContract(signer);
  const addresses = await resolveContractAddresses(bookingManager);

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
    chainId: network.chainId.toString(),
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
