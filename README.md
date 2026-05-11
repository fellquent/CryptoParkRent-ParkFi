# ParkFi - Decentralized Parking Marketplace

ParkFi is a decentralized application for renting parking spots with crypto payments. Parking owners can list a spot on a map, renters can reserve a time window, and the payment is handled by smart contracts instead of a central platform.

The goal is to make short-term parking rental transparent: the spot data, bookings, NFT ownership, and payment state are stored on-chain, while the frontend gives users a normal map-based booking experience.

---

## Project Description

ParkFi lets users:

- Connect a MetaMask wallet.
- Add parking spots with map-selected coordinates, hourly price, and supported vehicle type.
- Browse active parking spots on an OpenStreetMap/Leaflet map.
- Book a spot in 15-minute time slots.
- Lock ETH in escrow while the booking is active.
- Cancel future bookings according to contract rules.
- Redeem owner payment after a booking starts.
- Receive a non-transferable NFT for each created parking spot.

Each parking spot is represented by a `ParkingPermitNFT` token. The NFT proves ownership of the spot listing and is also used by the booking contract to assign temporary ERC-4907-style usage rights to renters during active bookings.

---

## Architecture Overview

The project has two main parts: Solidity smart contracts and a React frontend.

### Smart Contracts

The contracts are in `contracts/contracts/`.

- `ParkingPermitNFT.sol`
  - ERC-721 NFT contract for parking spot ownership.
  - Uses ERC-4907-style `userOf` and `userExpires` logic for active rentals.
  - Spot NFTs are non-transferable after minting.

- `ParkingRegistry.sol`
  - Creates, updates, hides, and deactivates parking spots.
  - Stores spot metadata: name, description, E6 coordinates, price per hour, vehicle type, availability, and active state.
  - Mints one `ParkingPermitNFT` for each created spot.

- `BookingManager.sol`
  - Creates bookings and stores booking history.
  - Checks overlap rules and 15-minute slot alignment.
  - Calculates prorated ETH price by duration.
  - Holds escrowed ETH, handles cancellations, releases payments, and tracks platform fees.

- `SharedTypes.sol`
  - Shared structs and enums used by the registry and booking contracts.

### Frontend

The frontend is in `frontend/` and uses React, Vite, ethers.js, MetaMask, and Leaflet.

- The frontend only needs `VITE_BOOKING_MANAGER_ADDRESS`.
- It reads `ParkingRegistry` and `ParkingPermitNFT` addresses from the deployed `BookingManager`.
- Users interact with the contracts through MetaMask transactions.
- The map shows active parking spots and highlights currently used spots.
- The booking page uses a calendar/timeline UI with 15-minute slots.

---

## Deployment Details

The contracts were deployed to **Ethereum Sepolia testnet** using **Hardhat**. Contract verification was done manually using **Remix IDE**.

Network:

- Ethereum Sepolia
- Chain ID: `11155111`
- Explorer: `https://sepolia.etherscan.io`

Deployed contracts:

| Contract | Address | Verified Contract Link |
| --- | --- | --- |
| `ParkingPermitNFT` | `0xb3D2e1D2f365Bf4f3B5aDC3acAb1B62535D9EF97` | [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0xb3D2e1D2f365Bf4f3B5aDC3acAb1B62535D9EF97#code) |
| `ParkingRegistry` | `0x26E2846a3147Ed264CA8067020a36A20dF18562B` | [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0x26E2846a3147Ed264CA8067020a36A20dF18562B#code) |
| `BookingManager` | `0xbACE365cFF040e8C3db30AB218a1e3e249FD3303` | [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0xbACE365cFF040e8C3db30AB218a1e3e249FD3303#code) |

For the frontend on Sepolia, use:

```env
VITE_BOOKING_MANAGER_ADDRESS=0xbACE365cFF040e8C3db30AB218a1e3e249FD3303
```

---

## Setup Instructions

### Prerequisites

- Node.js and npm
- MetaMask browser extension
- Sepolia ETH if running on Sepolia
- For local development, add a MetaMask network:
  - RPC URL: `http://127.0.0.1:8545`
  - Chain ID: `31337`
  - Currency: `ETH`

Install dependencies:

```bash
cd contracts
npm install

cd ../frontend
npm install
```

### Run Locally With Hardhat

Use three terminals.

Terminal 1, start a local blockchain:

```bash
cd contracts
npm run node
```

Terminal 2, deploy contracts to the local chain:

```bash
cd contracts
npm run deploy:local
```

Copy the printed `BookingManager` address and create/update `frontend/.env`:

```env
VITE_BOOKING_MANAGER_ADDRESS=0xYOUR_LOCAL_BOOKING_MANAGER_ADDRESS
```

Terminal 3, run the frontend:

```bash
cd frontend
npm run dev
```

Open the Vite URL, usually:

```text
http://localhost:5173
```

Switch MetaMask to the local Hardhat network and connect a funded local account.

### Run Against Sepolia

Create/update `frontend/.env`:

```env
VITE_BOOKING_MANAGER_ADDRESS=0xbACE365cFF040e8C3db30AB218a1e3e249FD3303
```

Start the frontend:

```bash
cd frontend
npm run dev
```

Switch MetaMask to Sepolia and connect the wallet. All transactions will use Sepolia ETH.

### Deploy New Contracts To Sepolia

Create `contracts/.env`:

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
DEPLOYER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY
```

Deploy:

```bash
cd contracts
npm run deploy:sepolia
```

After deployment, update `frontend/.env` with the new `BookingManager` address.

---

## Testing

Run smart contract tests:

```bash
cd contracts
npm run test
```

The test suite covers critical contract paths such as:

- Spot creation and NFT minting.
- Vehicle type validation.
- Spot update, availability, and deactivation.
- Unauthorized access failures.
- Non-transferable NFT behavior.
- Booking creation, activation, overlap rejection, 15-minute pricing, and incorrect payment failures.

Build the frontend:

```bash
cd frontend
npm run build
```

---

## Known Limitations

- Booking activation is not fully automatic. A transaction must call `activateBooking`, or an automation service would be needed.
- NFT metadata currently uses a placeholder base URI, so NFTs may not display rich images/metadata in MetaMask.
- The app uses Sepolia ETH only; it is not deployed to mainnet.
- There is no advanced search or filtering by price, distance, or vehicle type yet.
- The frontend depends on MetaMask/RPC reliability, so public RPC issues can affect reads.
- Contract upgrades are not implemented; changing contract logic requires redeployment.

Given more time, we would add richer NFT metadata, automated booking activation, better map search, contract coverage reports, and a stronger production deployment pipeline.

---

## What We Learned

We learned how to develop larger Solidity contracts that work together instead of building one simple contract. We connected multiple contracts to a real dApp frontend, handled wallet transactions through MetaMask, and managed contract addresses across local and Sepolia networks.

We also learned how to verify deployed contracts, including using Remix IDE for verification, and how to create our own NFT contract for parking spot ownership. The project helped us understand the practical connection between smart contract design, frontend state, blockchain transactions, and user experience.

---

## Conclusion

ParkFi demonstrates a working decentralized parking marketplace where users can list spots, book time windows, pay with ETH, and receive NFT-backed ownership for listed spots. The project combines Solidity contracts, NFT logic, escrow payments, a map-based React frontend, and Sepolia deployment into one complete dApp.
