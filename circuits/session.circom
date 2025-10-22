pragma circom 2.1.5;

// Minimal session circuit prototype.
// Public inputs: nodeCommitment, sessionNonce, bandwidth
// Private input: nodeSecret
// Constraint: nodeCommitment == nodeSecret + sessionNonce (placeholder commitment)
// Constraint: bandwidth fits in 32 bits (via boolean decomposition)

template IsBit() {
    signal input in;
    in * (in - 1) === 0;
}

template Session() {
    // Public
    signal input nodeCommitment;
    signal input sessionNonce;
    signal input bandwidth;

    // Private
    signal input nodeSecret;
    signal input bandwidthBits[32];

    // Commitment relation (placeholder; replace with a hash like Poseidon in later iteration)
    signal commit;
    commit <== nodeSecret + sessionNonce;
    commit === nodeCommitment;

    // bandwidth in [0, 2^32)
    component bits[32];
    signal partial[33];
    signal terms[32];
    partial[0] <== 0;
    for (var i = 0; i < 32; i++) {
        bits[i] = IsBit();
        bits[i].in <== bandwidthBits[i];
        terms[i] <== bandwidthBits[i] * (1 << i);
        partial[i + 1] <== partial[i] + terms[i];
    }
    partial[32] === bandwidth;
}

component main = Session();
