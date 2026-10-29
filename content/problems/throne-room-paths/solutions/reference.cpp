class Solution {
public:
    int countSafePaths(vector<string>& hall, int courage) {
        const int MOD = 1'000'000'007;
        int rows = hall.size(), cols = hall[0].size(), K = courage + 1;
        // ways[c * K + t]: routes to (current row, c) that crossed exactly t traps.
        vector<int> ways(cols * K, 0), next(cols * K, 0);
        for (int r = 0; r < rows; r++) {
            fill(next.begin(), next.end(), 0);
            for (int c = 0; c < cols; c++) {
                char cell = hall[r][c];
                if (cell == '#') continue;
                int trap = cell == 'T';
                for (int t = trap; t < K; t++) {
                    long long v = 0;
                    if (r == 0 && c == 0) v = (t == trap);
                    if (r > 0) v += ways[c * K + t - trap];
                    if (c > 0) v += next[(c - 1) * K + t - trap];
                    next[c * K + t] = v % MOD;
                }
            }
            swap(ways, next);
        }
        long long total = 0;
        for (int t = 0; t < K; t++) total += ways[(cols - 1) * K + t];
        return total % MOD;
    }
};
