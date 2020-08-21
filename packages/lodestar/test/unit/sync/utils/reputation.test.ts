import PeerId from "peer-id";
import {config} from "@chainsafe/lodestar-config/lib/presets/minimal";
import {Metadata} from "@chainsafe/lodestar-types";
import {ReputationStore} from "../../../../src/sync/IReputation";
import {updateMetadata, findMissingSubnets} from "../../../../src/sync/utils/reputation";
import {expect} from "chai";

describe("updateMetadata", function () {
  it("should update metadata, old metadata does not exist", async () => {
    const peer1 = await PeerId.create();
    const metadata: Metadata = {
      seqNumber: BigInt(1),
      attnets: Array(64).fill(true),
    };
    const reps = new ReputationStore();
    updateMetadata(reps, peer1.toB58String(), metadata);
    const updatedMetadata = reps.getFromPeerId(peer1).latestMetadata;
    expect(config.types.Metadata.equals(metadata, updatedMetadata as Metadata)).to.be.true;
  });

  it("should update metadata, new metadata is good", async () => {
    const peer1 = await PeerId.create();
    const oldMetadata: Metadata = {
      seqNumber: BigInt(1),
      attnets: Array(64).fill(false),
    };
    const reps = new ReputationStore();
    reps.getFromPeerId(peer1).latestMetadata = oldMetadata;
    const newMetadata: Metadata = {
      seqNumber: BigInt(10),
      attnets: Array(64).fill(true),
    };
    updateMetadata(reps, peer1.toB58String(), newMetadata);
    const updatedMetadata = reps.getFromPeerId(peer1).latestMetadata;
    expect(config.types.Metadata.equals(newMetadata, updatedMetadata as Metadata)).to.be.true;
  });

  it("should not update metadata, new metadata is not good", async () => {
    const peer1 = await PeerId.create();
    const oldMetadata: Metadata = {
      seqNumber: BigInt(10),
      attnets: Array(64).fill(false),
    };
    const reps = new ReputationStore();
    reps.getFromPeerId(peer1).latestMetadata = oldMetadata;
    const newMetadata: Metadata = {
      seqNumber: BigInt(1),
      attnets: Array(64).fill(true),
    };
    updateMetadata(reps, peer1.toB58String(), newMetadata);
    const latestMetadata = reps.getFromPeerId(peer1).latestMetadata;
    expect(config.types.Metadata.equals(oldMetadata, latestMetadata as Metadata)).to.be.true;
  });
});

describe("findMissingSubnets", function () {
  it("should return all subnets, no peer", function () {
    const reps = new ReputationStore();
    const missingSubnets = findMissingSubnets(reps);
    for (let i = 0; i < 64; i++) {
      expect(missingSubnets[i]).to.be.equal(i);
    }
  });

  it("should return all subnets, peers exist", async function () {
    const reps = new ReputationStore();
    const missingSubnets = findMissingSubnets(reps);
    const peers: PeerId[] = [];
    peers.push(await PeerId.create());
    peers.push(await PeerId.create());
    reps.getFromPeerId(peers[0]).latestMetadata = null;
    reps.getFromPeerId(peers[1]).latestMetadata = {
      seqNumber: BigInt(1),
      attnets: Array(64).fill(false),
    };

    for (let i = 0; i < 64; i++) {
      expect(missingSubnets[i]).to.be.equal(i);
    }
  });

  it("should return no missing subnets", async function () {
    const reps = new ReputationStore();
    const peers: PeerId[] = [];
    peers.push(await PeerId.create());
    peers.push(await PeerId.create());
    reps.getFromPeerId(peers[0]).latestMetadata = null;
    reps.getFromPeerId(peers[1]).latestMetadata = {
      seqNumber: BigInt(1),
      attnets: Array(64).fill(true),
    };
    const missingSubnets = findMissingSubnets(reps, peers);
    expect(missingSubnets).to.be.deep.equal([]);
  });

  it("should return some missing subnets", async function () {
    const reps = new ReputationStore();
    const peers: PeerId[] = [];
    peers.push(await PeerId.create());
    peers.push(await PeerId.create());
    const attnets0 = Array(64).fill(false);
    attnets0[0] = true;
    attnets0[1] = true;
    reps.getFromPeerId(peers[0]).latestMetadata = {
      seqNumber: BigInt(1),
      attnets: attnets0,
    };
    const attnets1 = Array(64).fill(false);
    attnets1[2] = true;
    attnets1[3] = true;

    reps.getFromPeerId(peers[1]).latestMetadata = {
      seqNumber: BigInt(1),
      attnets: attnets1,
    };
    const missingSubnets = findMissingSubnets(reps, peers);
    const expected: number[] = [];
    for (let i = 4; i < 64; i++) {
      expected.push(i);
    }
    expect(missingSubnets).to.be.deep.equal(expected);
  });
});
