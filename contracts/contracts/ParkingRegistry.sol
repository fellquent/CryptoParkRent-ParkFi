// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "./ParkingPermitNFT.sol";
import "./SharedTypes.sol";

contract ParkingRegistry is Ownable, Pausable {
    ParkingPermitNFT public immutable spotNFT;
    uint256 private _nextSpotId = 1;

    mapping(uint256 => SharedTypes.ParkingSpot) private _spots;
    mapping(address => uint256[]) private _ownerSpots;

    event ParkingSpotCreated(
        uint256 indexed spotId,
        address indexed owner,
        uint256 pricePerHour
    );

    event ParkingSpotUpdated(uint256 indexed spotId);

    event ParkingSpotAvailabilityChanged(
        uint256 indexed spotId,
        bool isAvailable
    );

    event ParkingSpotDeactivated(uint256 indexed spotId);

    constructor(
        address nftAddress,
        address initialOwner
    ) Ownable(initialOwner) {
        require(nftAddress != address(0), "Invalid NFT address");
        spotNFT = ParkingPermitNFT(nftAddress);
    }

    function createParkingSpot(
        string calldata locationName,
        string calldata description,
        int256 latitudeE6,
        int256 longitudeE6,
        uint256 pricePerHour,
        uint256 vehicleSize
    ) external whenNotPaused returns (uint256) {
        require(bytes(locationName).length > 0, "Location required");
        require(pricePerHour > 0, "Price must be > 0");
        require(
            vehicleSize >= 1 && vehicleSize <= 5,
            "Invalid vehicle size"
        );

        require(
            latitudeE6 >= -90000000 && latitudeE6 <= 90000000,
            "Invalid latitude"
        );

        require(
            longitudeE6 >= -180000000 && longitudeE6 <= 180000000,
            "Invalid longitude"
        );

        uint256 spotId = _nextSpotId++;

        _spots[spotId] = SharedTypes.ParkingSpot({
            id: spotId,
            owner: msg.sender,
            locationName: locationName,
            description: description,
            latitudeE6: latitudeE6,
            longitudeE6: longitudeE6,
            pricePerHour: pricePerHour,
            vehicleSize: vehicleSize,
            isAvailable: true,
            isActive: true
        });

        _ownerSpots[msg.sender].push(spotId);
        spotNFT.mintParkingSpot(msg.sender, spotId);

        emit ParkingSpotCreated(spotId, msg.sender, pricePerHour);

        return spotId;
    }

    function updateParkingSpot(
        uint256 spotId,
        string calldata locationName,
        string calldata description,
        uint256 pricePerHour,
        uint256 vehicleSize
    ) external whenNotPaused {
        SharedTypes.ParkingSpot storage spot = _spots[spotId];

        require(spotNFT.ownerOf(spotId) == msg.sender, "Not owner");
        require(spot.isActive, "Spot inactive");
        require(pricePerHour > 0, "Price must be > 0");
        require(
            vehicleSize >= 1 && vehicleSize <= 5,
            "Invalid vehicle size"
        );

        spot.locationName = locationName;
        spot.description = description;
        spot.pricePerHour = pricePerHour;
        spot.vehicleSize = vehicleSize;

        emit ParkingSpotUpdated(spotId);
    }

    function setSpotAvailability(
        uint256 spotId,
        bool isAvailable
    ) external whenNotPaused {
        SharedTypes.ParkingSpot storage spot = _spots[spotId];

        require(spotNFT.ownerOf(spotId) == msg.sender, "Not owner");
        require(spot.isActive, "Spot inactive");

        spot.isAvailable = isAvailable;

        emit ParkingSpotAvailabilityChanged(spotId, isAvailable);
    }

    function deactivateSpot(uint256 spotId) external {
        SharedTypes.ParkingSpot storage spot = _spots[spotId];

        require(
            spotNFT.ownerOf(spotId) == msg.sender || owner() == msg.sender,
            "Unauthorized"
        );

        spot.isActive = false;

        emit ParkingSpotDeactivated(spotId);
    }

    function getParkingSpot(
        uint256 spotId
    ) external view returns (SharedTypes.ParkingSpot memory) {
        return _spots[spotId];
    }

    function getOwnerSpots(
        address ownerAddress
    ) external view returns (uint256[] memory) {
        return _ownerSpots[ownerAddress];
    }

    function getAllActiveSpots()
        external
        view
        returns (SharedTypes.ParkingSpot[] memory)
    {
        uint256 count = 0;
        uint256 totalSpots = _nextSpotId - 1;

        for (uint256 i = 1; i <= totalSpots; i++) {
            if (_spots[i].isActive && _spots[i].isAvailable) {
                count++;
            }
        }

        SharedTypes.ParkingSpot[] memory result = new SharedTypes.ParkingSpot[](
            count
        );
        uint256 idx = 0;

        for (uint256 i = 1; i <= totalSpots; i++) {
            if (_spots[i].isActive && _spots[i].isAvailable) {
                result[idx++] = _spots[i];
            }
        }

        return result;
    }

    function getTotalSpots() external view returns (uint256) {
        return _nextSpotId - 1;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
