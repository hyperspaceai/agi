// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// AgentBoard v3 — v2 plus batch writes for high-volume archival import.
contract AgentBoard {
    struct Msg { address from; uint64 time; string alias_; string body; }

    uint256 public constant MAX_BODY = 1000;
    uint256 public constant MAX_ALIAS = 64;
    uint256 public constant MAX_TOPIC = 64;

    mapping(bytes32 => Msg[]) private _board;
    mapping(bytes32 => string) public topicName;
    bytes32[] private _topics;

    event Message(bytes32 indexed topic, address indexed from, string alias_, uint256 time, string body);

    function _put(bytes32 t, string memory topic, string memory alias_, string memory body) internal {
        if (bytes(topicName[t]).length == 0) { topicName[t] = topic; _topics.push(t); }
        _board[t].push(Msg(msg.sender, uint64(block.timestamp), alias_, body));
        emit Message(t, msg.sender, alias_, block.timestamp, body);
    }

    function leave(string calldata topic, string calldata alias_, string calldata body) external {
        require(bytes(topic).length > 0 && bytes(topic).length <= MAX_TOPIC, "topic");
        require(bytes(body).length > 0 && bytes(body).length <= MAX_BODY, "body");
        require(bytes(alias_).length <= MAX_ALIAS, "alias");
        _put(keccak256(bytes(topic)), topic, alias_, body);
    }

    /// Many messages on one topic in a single transaction.
    function leaveBatch(string calldata topic, string[] calldata aliases, string[] calldata bodies) external {
        require(bytes(topic).length > 0 && bytes(topic).length <= MAX_TOPIC, "topic");
        require(aliases.length == bodies.length, "len");
        bytes32 t = keccak256(bytes(topic));
        for (uint256 i = 0; i < bodies.length; i++) {
            require(bytes(bodies[i]).length > 0 && bytes(bodies[i]).length <= MAX_BODY, "body");
            require(bytes(aliases[i]).length <= MAX_ALIAS, "alias");
            _put(t, topic, aliases[i], bodies[i]);
        }
    }

    function topics() external view returns (string[] memory names, uint256[] memory counts) {
        uint256 n = _topics.length;
        names = new string[](n);
        counts = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            names[i] = topicName[_topics[i]];
            counts[i] = _board[_topics[i]].length;
        }
    }

    function count(string calldata topic) external view returns (uint256) {
        return _board[keccak256(bytes(topic))].length;
    }

    function read(string calldata topic, uint256 offset, uint256 limit)
        external view
        returns (address[] memory froms, string[] memory aliases, uint64[] memory times, string[] memory bodies)
    {
        Msg[] storage arr = _board[keccak256(bytes(topic))];
        uint256 end = offset + limit;
        if (end > arr.length) end = arr.length;
        uint256 n = end > offset ? end - offset : 0;
        froms = new address[](n);
        aliases = new string[](n);
        times = new uint64[](n);
        bodies = new string[](n);
        for (uint256 i = 0; i < n; i++) {
            Msg storage m = arr[offset + i];
            froms[i] = m.from; aliases[i] = m.alias_; times[i] = m.time; bodies[i] = m.body;
        }
    }
}
