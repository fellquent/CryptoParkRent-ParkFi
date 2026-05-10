# ParkFi - Rent Parking Using Crypto

ParkFi is a decentralized parking marketplace. Parking owners can list spots, renters can book them for a time window, and ETH payments are held by smart contracts until the booking is finished.

The app uses a React/Vite frontend, MetaMask wallet connection, Leaflet/OpenStreetMap for map interactions, and Solidity contracts deployed with Hardhat.

---

## What Is Implemented

### Smart Contracts

The backend is split into three contracts:

- `ParkingPermitNFT` - non-transferable ERC-721 spot token with ERC-4907-style user assignment for active rentals.
- `ParkingRegistry` - creates, updates, toggles availability, and deactivates parking spots.
- `BookingManager` - creates bookings, holds escrowed ETH, handles cancellations, releases payments, and stores booking history.

Current contract features:

- Parking spots with name, description, latitude/longitude as E6 integers, price per hour, capacity, availability, and active/deactivated state.
- Booking with ETH escrow.
- Cancellation before a booking starts, using the contract's refund rules.
- Payment redemption after a booking ends.
- Platform fee accounting.
- Owner/admin controls for pausing, fees, and withdrawals at contract level.
- Deactivated spots are treated as removed from active UI, while booking history remains available.

### Frontend

- MetaMask wallet connection.
- Expected network check with a MetaMask switch/add-network prompt for local Hardhat.
- Wallet balance and transaction progress feedback.
- Interactive map of active parking spots.
- Yellow markers for spots currently in use.
- Add spot form with map-based point picker instead of manual coordinate entry.
- Booking page for selecting start time and duration.
- Booking page shows existing reserved/active windows before submitting.
- Profile dashboard for renter bookings, owned spots, spot editing, deactivation, cancellation, and payment redemption.

---

## Project Structure

```text
contracts/
  contracts/
    BookingManager.sol
    ParkingPermitNFT.sol
    ParkingRegistry.sol
    SharedTypes.sol
  scripts/deploy.js
  hardhat.config.js

frontend/
  src/
    components/
    pages/
    services/
    config/contracts.js
  vite.config.js
```

---

## Prerequisites

- Node.js and npm
- MetaMask browser extension
- For local development: a MetaMask local network configured with:
  - RPC URL: `http://127.0.0.1:8545`
  - Chain ID: `31337`
  - Currency: `ETH`
- For Sepolia: Sepolia ETH, an RPC URL, and a deployer wallet private key

Install dependencies:

```bash
cd contracts
npm install

cd ../frontend
npm install
```

---

## Run With Local Blockchain

Use three terminals.

### 1. Start the local Hardhat chain

```bash
cd contracts
npm run node
```

Keep this terminal running. Hardhat prints funded test accounts; import one private key into MetaMask if needed.

### 2. Deploy contracts locally

In a second terminal:

```bash
cd contracts
npm run deploy:local
```

Copy the `BookingManager` address from the deployment output:

```text
Booking: 0x...
```

### 3. Configure and run the frontend

Create or update `frontend/.env.local`:

```env
VITE_BOOKING_MANAGER_ADDRESS=0xYOUR_LOCAL_BOOKING_MANAGER_ADDRESS
VITE_EXPECTED_CHAIN_ID=31337
VITE_EXPECTED_CHAIN_NAME=Hardhat Local
VITE_EXPECTED_CHAIN_RPC_URL=http://127.0.0.1:8545
VITE_EXPECTED_CHAIN_CURRENCY=ETH
```

Then start Vite:

```bash
cd frontend
npm run dev
```

Open the Vite URL, usually:

```text
http://localhost:5173
```

In MetaMask, connect the wallet. The frontend will ask MetaMask to switch to the configured chain if needed. The frontend discovers `ParkingRegistry` and `ParkingPermitNFT` from `BookingManager`, so only `VITE_BOOKING_MANAGER_ADDRESS` changes after each redeploy.

---

## Run On Sepolia Testnet

### 1. Configure deployment secrets

Create `contracts/.env` from `contracts/.env.example`:

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
DEPLOYER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY
```

`ETHERSCAN_API_KEY` is included for future verification workflows; the current deploy script only needs the RPC URL and private key.

Make sure the deployer account has Sepolia ETH.

### 2. Deploy to Sepolia

```bash
cd contracts
npm run deploy:sepolia
```

Copy the deployed `BookingManager` address:

```text
Booking: 0x...
```

### 3. Point the frontend to Sepolia

Create or update `frontend/.env.local`:

```env
VITE_BOOKING_MANAGER_ADDRESS=0xYOUR_SEPOLIA_BOOKING_MANAGER_ADDRESS
VITE_EXPECTED_CHAIN_ID=11155111
VITE_EXPECTED_CHAIN_NAME=Sepolia
VITE_EXPECTED_CHAIN_CURRENCY=ETH
```

Start the frontend:

```bash
cd frontend
npm run dev
```

Switch MetaMask to Sepolia, connect your wallet, and use the app. Transactions will use Sepolia ETH.

---

## Useful Commands

Contracts:

```bash
cd contracts
npm run compile
npm run test
npm run node
npm run deploy:local
npm run deploy:sepolia
```

Frontend:

```bash
cd frontend
npm run dev
npm run build
npm run preview
```

---

## Basic User Flow

1. Connect MetaMask.
2. Owner creates a parking spot and chooses its point on the map.
3. Renter browses active spots on the map.
4. Renter selects a spot and books a time range.
5. ETH is locked in the booking contract.
6. Owner redeems payment after the booking ends.
7. Booking history remains visible in the profile dashboard.

---

## Notes

- Smart contracts cannot automatically run future actions. If a booking should become active exactly at start time, someone must call `activateBooking`, or an automation service would be needed.
- The frontend colors a spot yellow when current time is inside an active/reserved booking window, even if `activateBooking` was not called.
- Deactivation is a soft delete: the spot is hidden from active map/owner management, but historical bookings can still reference it.
