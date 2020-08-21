import {INetwork} from "../../network";
import {ILogger} from "@chainsafe/lodestar-utils";
import {IBeaconConfig} from "@chainsafe/lodestar-config";
import {IReputationStore} from "../../sync/IReputation";
import {Metadata} from "@chainsafe/lodestar-types";
import {updateMetadata, findMissingSubnets} from "../../sync/utils/reputation";

export interface IDiversifyPeersModules {
  network: INetwork;
  reps: IReputationStore;
  logger: ILogger;
}

/*
 ** A task to run periodically to make sure we have at least one peer per subnet
 ** so we can spread all attestations to the network and let them be aggregated in the end.
 */
export class DiversifyPeersBySubnetTask {
  private readonly config: IBeaconConfig;
  private readonly network: INetwork;
  private peerReputations: IReputationStore;

  private readonly logger: ILogger;
  private testInterval?: NodeJS.Timeout;

  public constructor(config: IBeaconConfig, modules: IDiversifyPeersModules) {
    this.config = config;
    this.network = modules.network;
    this.peerReputations = modules.reps;
    this.logger = modules.logger;
  }

  public async start(): Promise<void> {
    this.testInterval = setInterval(
      this.run,
      this.config.params.EPOCHS_PER_RANDOM_SUBNET_SUBSCRIPTION *
        this.config.params.SLOTS_PER_EPOCH *
        this.config.params.SECONDS_PER_SLOT *
        1000
    );
  }

  public async stop(): Promise<void> {
    if (this.testInterval) {
      clearInterval(this.testInterval);
    }
  }

  public run = async (): Promise<void> => {
    this.logger.info("Running DiversifyPeersBySubnetTask");
    this.logger.profile("DiversifyPeersBySubnetTask");
    const metadataByPeer = new Map<string, Metadata | null>();
    const peers = this.network.getPeers();
    await Promise.all(
      peers.map(async (peer) => {
        try {
          const metadata = await this.network.reqResp.metadata(peer);
          metadataByPeer.set(peer.toB58String(), metadata);
        } catch (e) {
          this.logger.warn("Cannot get metadata from peer" + peer.toB58String(), e.message);
          metadataByPeer.set(peer.toB58String(), null);
        }
      })
    );
    for (const [peer, metadata] of metadataByPeer.entries()) {
      updateMetadata(this.peerReputations, peer, metadata);
    }
    const missingSubnets = findMissingSubnets(this.peerReputations, peers);
    if (missingSubnets.length > 0) {
      this.logger.info(`Search for ${missingSubnets.length} missing subnets: ` + missingSubnets.join(","));
    } else {
      this.logger.info("Connected to all subnets!");
    }
    await Promise.all(
      missingSubnets.map(async (subnet) => {
        try {
          await this.network.searchSubnetPeers(String(subnet));
        } catch (e) {
          this.logger.warn("Cannot search subnet " + subnet, e.message);
        }
      })
    );
    this.logger.profile("DiversifyPeersBySubnetTask");
  };
}
