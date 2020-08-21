import {IReputationStore} from "../IReputation";
import {Metadata, ATTESTATION_SUBNET_COUNT} from "@chainsafe/lodestar-types";
import PeerId from "peer-id";

/**
 * Update new metadata to reputation store.
 */
export function updateMetadata(reps: IReputationStore, peerId: string, newMetadata: Metadata | null): void {
  if (!reps) return;
  const oldMetadata = reps.get(peerId).latestMetadata;
  if (!oldMetadata) {
    reps.get(peerId).latestMetadata = newMetadata;
    return;
  }
  if (!newMetadata) return;
  if (oldMetadata.seqNumber < newMetadata.seqNumber) reps.get(peerId).latestMetadata = newMetadata;
}

/**
 * Find subnets that we don't have at least 1 connected peer.
 */
export function findMissingSubnets(reps: IReputationStore, peers: PeerId[] = []): number[] {
  const attNets = peers
    .map((peer) => reps.getFromPeerId(peer).latestMetadata)
    .filter((metadata) => !!metadata)
    .map((metadata) => {
      return metadata ? metadata.attnets : [];
    });
  const missingSubnets: number[] = [];
  for (let subnet = 0; subnet < ATTESTATION_SUBNET_COUNT; subnet++) {
    if (!attNets.some((attNet) => attNet[subnet])) {
      missingSubnets.push(subnet);
    }
  }
  return missingSubnets;
}
