// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "../SharedTypes.sol";

interface IParkingRegistry {
    function getParkingSpot(
        uint256 spotId
    ) external view returns (SharedTypes.ParkingSpot memory);

    function getAllActiveSpots()
        external
        view
        returns (SharedTypes.ParkingSpot[] memory);

    function getTotalSpots() external view returns (uint256);

    function getOwnerSpots(address ownerAddress)
        external
        view
        returns (uint256[] memory);
}