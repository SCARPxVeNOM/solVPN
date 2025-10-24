pragma circom 2.0.0;

// Sum proof: proves sum(inputs) == total (public)
// Configure N as the number of intervals (e.g., 8)
template SumProof(N) {
    signal input inputs[N]; // private counters
    signal output total;

    var sum = 0;
    for (var i = 0; i < N; i++) {
        sum += inputs[i];
    }
    total <== sum;
}

component main = SumProof(8);

