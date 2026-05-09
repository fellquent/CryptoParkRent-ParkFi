// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface IERC4907 {
    event UpdateUser(
        uint256 indexed tokenId,
        address indexed user,
        uint64 expires
    );

    function setUser(
        uint256 tokenId,
        address user,
        uint64 expires
    ) external;

    function userOf(uint256 tokenId) external view returns (address);

    function userExpires(uint256 tokenId) external view returns (uint256);
}

contract ParkingPermitNFT is ERC721, Ownable, IERC4907 {
    using Strings for uint256;

    struct UserInfo {
        address user;
        uint64 expires;
    }

    mapping(uint256 => UserInfo) private _users;

    address public bookingManager;
    address public registry;

    string private _baseTokenURI;

    event ParkingSpotMinted(
        uint256 indexed tokenId,
        address indexed owner
    );

    event BookingManagerUpdated(address indexed bookingManager);
    event RegistryUpdated(address indexed registry);

    modifier onlyBookingManager() {
        require(msg.sender == bookingManager, "Not booking manager");
        _;
    }

    modifier onlyRegistry() {
        require(msg.sender == registry, "Not registry");
        _;
    }

    constructor(
        address initialOwner,
        string memory baseURI
    )
        ERC721("ParkFi Spot", "PFS")
        Ownable(initialOwner)
    {
        _baseTokenURI = baseURI;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override returns (bool) {
        return
            interfaceId == type(IERC4907).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function setBookingManager(address manager) external onlyOwner {
        require(manager != address(0), "Invalid address");

        bookingManager = manager;

        emit BookingManagerUpdated(manager);
    }

    function setRegistry(address registryAddress) external onlyOwner {
        require(registryAddress != address(0), "Invalid address");

        registry = registryAddress;

        emit RegistryUpdated(registryAddress);
    }

    function mintParkingSpot(
        address spotOwner,
        uint256 tokenId
    ) external onlyRegistry returns (uint256) {
        _safeMint(spotOwner, tokenId);

        emit ParkingSpotMinted(tokenId, spotOwner);

        return tokenId;
    }

    function setUser(
        uint256 tokenId,
        address user,
        uint64 expires
    ) external onlyBookingManager {
        _requireOwned(tokenId);

        _users[tokenId] = UserInfo({
            user: user,
            expires: expires
        });

        emit UpdateUser(tokenId, user, expires);
    }

    function userOf(uint256 tokenId) public view returns (address) {
        _requireOwned(tokenId);

        if (uint256(_users[tokenId].expires) >= block.timestamp) {
            return _users[tokenId].user;
        }

        return address(0);
    }

    function userExpires(uint256 tokenId) external view returns (uint256) {
        _requireOwned(tokenId);

        return _users[tokenId].expires;
    }

    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        _requireOwned(tokenId);

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

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);

        if (from != address(0) && to != address(0)) {
            revert("Spot transfers disabled");
        }

        if (to == address(0) && _users[tokenId].user != address(0)) {
            delete _users[tokenId];
        }

        return super._update(to, tokenId, auth);
    }
}
