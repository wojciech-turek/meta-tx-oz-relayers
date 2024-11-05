// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

contract MyForwarder is ERC2771Forwarder {
    constructor() ERC2771Forwarder("MyForwarder") {}
}
