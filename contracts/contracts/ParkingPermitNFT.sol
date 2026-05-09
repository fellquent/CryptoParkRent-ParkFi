// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract ParkingPermitNFT is ERC721, Ownable {
    using Strings for uint256;

    struct PermitData {
        uint256 bookingId;
        uint256 parkingSpotId;
        uint256 expirationTime;
    }

    uint256 private _nextTokenId = 1;

    // tokenId => permit data
    mapping(uint256 => PermitData) public permits;

    // bookingId => tokenId
    mapping(uint256 => uint256) public bookingToToken;

    address public bookingManager;

    string private _baseTokenURI;

    event PermitMinted(
        uint256 indexed tokenId,
        uint256 indexed bookingId,
        address indexed renter
    );

    event BookingManagerUpdated(
        address indexed bookingManager
    );

    modifier onlyBookingManager() {
        require(
            msg.sender == bookingManager,
            "Not booking manager"
        );
        _;
    }

    constructor(
        address initialOwner,
        string memory baseURI
    )
        ERC721("ParkFi Permit", "PFP")
        Ownable(initialOwner)
    {
        _baseTokenURI = baseURI;
    }

    function setBookingManager(
        address manager
    ) external onlyOwner {
        require(
            manager != address(0),
            "Invalid address"
        );

        bookingManager = manager;

        emit BookingManagerUpdated(manager);
    }

    function mintPermit(
        address renter,
        uint256 bookingId,
        uint256 parkingSpotId,
        uint256 expirationTime
    )
        external
        onlyBookingManager
        returns (uint256)
    {
        require(
            bookingToToken[bookingId] == 0,
            "Permit already exists"
        );

        uint256 tokenId = _nextTokenId++;

        _safeMint(renter, tokenId);

        permits[tokenId] = PermitData({
            bookingId: bookingId,
            parkingSpotId: parkingSpotId,
            expirationTime: expirationTime
        });

        bookingToToken[bookingId] = tokenId;

        emit PermitMinted(
            tokenId,
            bookingId,
            renter
        );

        return tokenId;
    }

    function isPermitValid(
        uint256 tokenId
    ) external view returns (bool) {
        require(
            _ownerOf(tokenId) != address(0),
            "Permit does not exist"
        );

        return (
            block.timestamp <=
            permits[tokenId].expirationTime
        );
    }

    function burnExpiredPermit(
        uint256 tokenId
    ) external {
        require(
            _ownerOf(tokenId) != address(0),
            "Permit does not exist"
        );

        require(
            block.timestamp >
            permits[tokenId].expirationTime,
            "Permit still active"
        );

        _burn(tokenId);

        delete permits[tokenId];
    }

    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        require(
            _ownerOf(tokenId) != address(0),
            "Token does not exist"
        );

        return string(
            abi.encodePacked(
                _baseTokenURI,
                tokenId.toString(),
                ".json"
            )
        );
    }

    function setBaseURI(
        string calldata newBaseURI
    ) external onlyOwner {
        _baseTokenURI = newBaseURI;
    }

    function _baseURI()
        internal
        view
        override
        returns (string memory)
    {
        return _baseTokenURI;
    }
}