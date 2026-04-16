import time

class P2PGossipMonitor:
    """
    Monitor for the P2P gossip protocol in the AGI system.
    Tracks experiment distribution and agent synchronization.
    """
    def __init__(self, node_id):
        self.node_id = node_id
        self.stats = {"messages_sent": 0, "messages_received": 0, "active_peers": []}

    def log_message(self, direction, peer_id):
        if direction == "sent":
            self.stats["messages_sent"] += 1
        elif direction == "received":
            self.stats["messages_received"] += 1
        if peer_id not in self.stats["active_peers"]:
            self.stats["active_peers"].append(peer_id)

    def get_health(self):
        return {
            "node_id": self.node_id,
            "status": "Healthy" if len(self.stats["active_peers"]) > 0 else "Isolated",
            "stats": self.stats
        }
